begin;

-- Giving the machine the queue, and somewhere to put its answer
-- -----------------------------------------------------------------------
--
-- 0189 put every line said into `chat_to_read`. This hands it to `ai_work`
-- and teaches `apply_ai_verdict` what a verdict about a message means.
--
-- One new verdict: **`quieted`** - a chat suspension, on the ladder from
-- 0171. It exists because the two the machine had were both wrong for a
-- message. `warned` is nothing for somebody who has just told another
-- person to kill themselves, and `suspended` takes the whole account away
-- over one line. Five minutes of quiet, escalating if it keeps happening,
-- is the answer that fits what chat moderation actually is - and it is the
-- one Staw described in the first place.
--
-- **`delete` is still not a word this accepts**, and there is still no
-- branch that could do it. That has not moved.

create or replace function public.ai_work(how_many integer default 20)
returns table (
  subject text, subject_id text, kind text, name text, words text,
  picture text, waiting_minutes integer
)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare
  rules record;
  waiting integer;
begin
  if not (public.is_moderator() or public.is_the_worker()) then
    return;
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then return; end if;

  select
    (select count(*) from public.avatar_items where status = 'pending')
    + (select count(*) from public.assets where status = 'pending')
    + (select count(*) from public.reports where status = 'open')
    + (select count(*) from public.chat_to_read where read_at is null)
   into waiting;

  if rules.mode = 'busy' and waiting <= rules.when_over then return; end if;

  return query
    select 'avatar_item', i.id::text, i.kind, i.name,
           coalesce(i.description, ''),
           i.image_path,
           (extract(epoch from now() - i.created_at) / 60)::integer
      from public.avatar_items i
     where i.status = 'pending'
       and (rules.mode <> 'slow' or i.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'asset', a.id::text, a.kind::text, a.name,
           coalesce(a.description, ''),
           a.preview_path,
           (extract(epoch from now() - a.created_at) / 60)::integer
      from public.assets a
     where a.status = 'pending'
       and (rules.mode <> 'slow' or a.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    select 'report', r.id::text, r.reason,
           coalesce(s.label, r.target_type),
           coalesce(r.details, ''),
           null::text,
           (extract(epoch from now() - r.created_at) / 60)::integer
      from public.reports r
      cross join lateral public.report_subject(r.target_type, r.target_id) s
     where r.status = 'open'
       and (rules.mode <> 'slow' or r.created_at < now() - make_interval(mins => rules.after_minutes))
     union all
    /*
     * What people said. `name` carries who said it and whether the
     * patterns had already objected, because a line that arrived with
     * bullets in it is a different thing to read than one that did not.
     */
    select 'message', c.id::text, c.kind,
           coalesce(p.username, 'somebody')
             || case when c.was_masked then ' (already masked)' else '' end,
           c.body,
           null::text,
           (extract(epoch from now() - c.created_at) / 60)::integer
      from public.chat_to_read c
      left join public.profiles p on p.id = c.who
     where c.read_at is null
       and (rules.mode <> 'slow' or c.created_at < now() - make_interval(mins => rules.after_minutes))
     limit least(greatest(coalesce(how_many, 20), 1), 100);
end;
$$;

create or replace function public.apply_ai_verdict(
  subject text, subject_id text, decision text,
  reason text default null, model text default null, looked_at text default null
)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  rules record;
  who uuid;
  they record;
  line record;
begin
  if not (public.is_the_worker() or coalesce((select is_admin from public.profiles where id = auth.uid()), false)) then
    raise exception 'Only the moderation worker may do that.';
  end if;

  if decision not in ('approved', 'rejected', 'warned', 'quieted', 'suspended', 'nothing', 'unsure') then
    raise exception 'That is not a verdict this takes.';
  end if;

  select * into rules from public.ai_settings where id;
  if not rules.is_on then
    raise exception 'AI moderation is off.';
  end if;

  insert into public.ai_reviews (subject, subject_id, decision, reason, model, looked_at)
  values (subject, subject_id, decision, left(coalesce(reason, ''), 500), model, left(coalesce(looked_at, ''), 2000));

  -- Screening something.
  if subject = 'avatar_item' and decision in ('approved', 'rejected') then
    update public.avatar_items
       set status = (case when decision = 'approved' then 'approved' else 'rejected' end)::public.moderation_status
     where id = subject_id::uuid and status = 'pending';
    return;
  end if;

  if subject = 'asset' and decision in ('approved', 'rejected') then
    update public.assets
       set status = (case when decision = 'approved' then 'approved' else 'rejected' end)::public.moderation_status
     where id = subject_id::uuid and status = 'pending';
    return;
  end if;

  /*
   * A line somebody said.
   *
   * Marked read whatever the answer was - including 'nothing', which is
   * most of them. A queue that only clears when the machine objects is a
   * queue that never clears.
   */
  if subject = 'message' then
    select * into line from public.chat_to_read where id = subject_id::bigint;
    update public.chat_to_read set read_at = now() where id = subject_id::bigint;
    if line.who is null then return; end if;

    select is_admin, is_moderator, is_superadmin into they
      from public.profiles where id = line.who;
    if they is null then return; end if;
    if coalesce(they.is_admin, false) or coalesce(they.is_moderator, false)
       or coalesce(they.is_superadmin, false) then
      return;  -- staff are not the machine's to judge, and this is not an error
    end if;

    if decision = 'warned' then
      if not rules.may_warn then return; end if;
      insert into public.notifications (user_id, kind, body)
      values (line.who, 'system',
              left(coalesce(reason, 'Please keep to the Kobblon guidelines.'), 300));
      return;
    end if;

    if decision = 'quieted' then
      if not rules.may_warn then return; end if;
      perform public.mute_chat(
        line.who,
        left(coalesce(reason, 'Language that goes against the Kobblon guidelines.'), 300),
        'machine');
      return;
    end if;

    if decision = 'suspended' then
      if not rules.may_suspend then return; end if;
      perform public.flag_account(
        line.who, 'The machine judged this serious enough to suspend.', line.body);
      update public.profiles set is_suspended = true where id = line.who;
      insert into public.notifications (user_id, kind, body)
      values (line.who, 'system',
              left(coalesce(reason, 'Your account has been suspended.'), 300));
      return;
    end if;

    return;
  end if;

  -- Acting on a person: warnings and suspensions, and nothing else, ever.
  if subject = 'profile' and decision in ('warned', 'quieted', 'suspended') then
    who := subject_id::uuid;
    select is_admin, is_moderator, is_suspended into they
      from public.profiles where id = who;
    if they is null then return; end if;

    -- Staff are not the machine's to judge.
    if coalesce(they.is_admin, false) or coalesce(they.is_moderator, false) then
      raise exception 'Staff are not screened by the machine.';
    end if;

    if decision = 'warned' then
      if not rules.may_warn then raise exception 'It may not warn anybody.'; end if;
      insert into public.notifications (user_id, kind, body)
      values (who, 'system', left(coalesce(reason, 'A warning from Kobblon.'), 300));
      return;
    end if;

    if decision = 'quieted' then
      if not rules.may_warn then raise exception 'It may not warn anybody.'; end if;
      perform public.mute_chat(who, left(coalesce(reason, 'The guidelines.'), 300), 'machine');
      return;
    end if;

    if not rules.may_suspend then raise exception 'It may not suspend anybody.'; end if;
    update public.profiles set is_suspended = true where id = who;
    insert into public.notifications (user_id, kind, body)
    values (who, 'system', left(coalesce(reason, 'Your account has been suspended.'), 300));
    return;
  end if;

  -- 'nothing' and 'unsure' are recorded and do nothing, which is the point
  -- of having them: a machine that cannot say "I do not know" says something
  -- else instead.
end;
$$;

commit;

begin;

/*
 * "Got it", and it stays got.
 *
 * Staw, on the restriction card: "this card only appears once, if youve
 * clicked that got it button then it doesnt appear anymore".
 *
 * The website could have remembered that in the browser, and it would
 * have been wrong by the end of the day: a decision about an account is
 * not a per-browser fact, and somebody opening the site on their phone
 * would get the card again as though they had never read it. It belongs
 * where the other three already are, which is `violations.acknowledged_at`.
 *
 * `acknowledge_my_standing` already writes that column, but only for a
 * warning, or for every open row at once when a suspension runs out. An
 * account carrying nothing but a feature block fell through both branches
 * and got 'nothing' back, so there was no way to say you had read one.
 *
 * What this does NOT do, deliberately: the block stays on. Reading a
 * notice is not serving it. `my_account_standing` goes on reporting
 * `level = 'limited'` with the date and the reason, so the standing page
 * and the applications still know; it is the card over the page that
 * stops, and it stops because `acknowledged` comes back true.
 */
create or replace function public.acknowledge_my_standing()
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  suspended boolean;
  closed boolean;
  ends timestamptz;
  how_many integer;
  blocks integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select coalesce(p.is_suspended, false), coalesce(p.is_banned, false),
         p.suspended_until
    into suspended, closed, ends
    from public.profiles p where p.id = me;

  if closed or exists (
    select 1 from public.violations v
     where v.user_id = me and v.action = 'termination' and not v.is_void
  ) then
    raise exception 'This account has been closed. Ask for it to be looked at again.';
  end if;

  if suspended then
    if ends is null then
      raise exception 'This suspension does not have an end on it. Ask for it to be looked at again.';
    end if;
    if ends > now() then
      raise exception 'This suspension has not run out yet.';
    end if;

    update public.violations
       set acknowledged_at = now()
     where user_id = me and not is_void
       and action in ('suspension', 'feature_block', 'warning')
       and acknowledged_at is null;

    perform set_config('kobbleston.standing', 'on', true);
    update public.profiles
       set is_suspended = false, suspended_until = null
     where id = me;
    perform set_config('kobbleston.standing', 'off', true);

    perform public.write_admin_log('reactivate', me,
      jsonb_build_object('ran_out', ends, 'acknowledged', true));
    return 'back';
  end if;

  update public.violations
     set acknowledged_at = now()
   where user_id = me and not is_void
     and action = 'warning' and acknowledged_at is null;
  get diagnostics how_many = row_count;

  /*
   * And the one this migration is for. Separate from the warning above
   * rather than folded into its `where`, because the two answers are not
   * the same answer: a warning that is acknowledged is over, and a
   * feature block that is acknowledged is a feature block you have read.
   */
  update public.violations
     set acknowledged_at = now()
   where user_id = me and not is_void
     and action = 'feature_block' and acknowledged_at is null
     and (expires_at is null or expires_at > now());
  get diagnostics blocks = row_count;

  if how_many > 0 then
    perform public.write_admin_log('acknowledge', me,
      jsonb_build_object('warnings', how_many, 'blocks', blocks));
    return 'warning_cleared';
  end if;

  if blocks > 0 then
    perform public.write_admin_log('acknowledge', me,
      jsonb_build_object('warnings', 0, 'blocks', blocks));
    return 'noted';
  end if;

  return 'nothing';
end $$;

revoke all on function public.acknowledge_my_standing() from public;
grant execute on function public.acknowledge_my_standing() to authenticated;

commit;

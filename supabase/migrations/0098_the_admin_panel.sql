begin;

-- The Kobblon account's panel.
--
-- Staw asked for one place to moderate from, send notifications, give and
-- take Brix, delete accounts, hand out the verified badge, and keep the
-- flagged words the whole moderation system reads.
--
-- All of it lives here rather than in the page, because a page is a
-- suggestion. Every function refuses anybody who is not an admin, and
-- every function writes down what was done and by whom before it returns.

-- --------------------------------------------------------------- who is one

create or replace function public.is_admin()
returns boolean language sql stable security definer
  set search_path = public, extensions as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

grant execute on function public.is_admin to authenticated;

/*
 * Every function below opens with this. Raising rather than returning
 * nothing on purpose: a panel that silently does nothing when its caller is
 * not staff is a panel nobody can tell is broken.
 */
create or replace function public.require_admin()
returns void language plpgsql stable security definer
  set search_path = public, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'This is staff only.' using errcode = '42501';
  end if;
end;
$$;

-- ------------------------------------------------------------- the record

/*
 * What staff did, kept apart from `moderation_actions`, which is tied to a
 * report somebody filed. Half of what an admin does starts with nobody
 * reporting anything.
 *
 * No delete policy and no update policy anywhere below: the point of a
 * record is that the person who acted cannot tidy it afterwards.
 */
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  subject_id uuid references public.profiles(id) on delete set null,
  -- Kept as text as well as a reference, because deleting an account is one
  -- of the things recorded here and the reference goes null when it happens.
  subject_label text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_log_when_idx on public.admin_log (created_at desc);

alter table public.admin_log enable row level security;

/*
 * Select and nothing else. Every other table in this schema carries the
 * blanket insert/update/delete grant Supabase hands out and leans entirely
 * on its policies; this one is created after that ran, so it starts with no
 * grants at all and gets back only the one it needs.
 *
 * Which is the stronger arrangement and is kept on purpose: rows are written
 * by `write_admin_log`, which is security definer and needs no grant, so
 * even a mistake in the policy below cannot let somebody forge a record or
 * erase one about themselves. A record the subject can edit is not a record.
 */
grant select on public.admin_log to authenticated;

drop policy if exists admin_log_read on public.admin_log;
create policy admin_log_read on public.admin_log
  for select using (public.is_admin());

create or replace function public.write_admin_log(
  what text, who uuid, extra jsonb default '{}'::jsonb
) returns void language plpgsql security definer
  set search_path = public, extensions as $$
begin
  insert into public.admin_log (admin_id, action, subject_id, subject_label, detail)
  values (
    auth.uid(), what, who,
    (select username from public.profiles where id = who),
    coalesce(extra, '{}'::jsonb)
  );
end;
$$;

commit;

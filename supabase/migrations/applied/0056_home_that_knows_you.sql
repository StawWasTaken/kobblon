-- What the home page is made of.
--
-- Three lists it could not ask for before: what somebody might like, where
-- they have already been, and what they would rather not be shown again.
--
-- "Not interested" is the third of those, and it is the important one: a
-- recommendation somebody has said no to should not come back. It is kept per
-- person, and it only ever hides things from that person's own lists.
--
-- Safe to run again.

create table if not exists public.space_not_interested (
  user_id uuid not null references public.profiles on delete cascade,
  space_id uuid not null references public.spaces on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (user_id, space_id)
);

alter table public.space_not_interested enable row level security;

drop policy if exists not_interested_own on public.space_not_interested;
create policy not_interested_own on public.space_not_interested for select
  using (user_id = auth.uid());

revoke insert, update, delete on public.space_not_interested from anon, authenticated;
grant select on public.space_not_interested to authenticated;

/** Saying no to a recommendation, which is a promise that it stays gone. */
create or replace function public.hide_space(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;

  insert into public.space_not_interested (user_id, space_id)
  values (auth.uid(), target)
  on conflict do nothing;
end;
$$;

/** And changing your mind about one. */
create or replace function public.unhide_space(target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.space_not_interested
   where user_id = auth.uid() and space_id = target;
end;
$$;

/**
 * Spaces somebody might like.
 *
 * Nothing clever: what people are visiting and liking, minus your own, minus
 * anything you have said no to, with a little randomness so the page is not
 * the same every time. It is honest about being a popularity list rather than
 * pretending to know anybody.
 */
create or replace function public.recommended_spaces(limit_count integer default 12)
returns setof public.spaces
language sql stable security definer set search_path = public as $$
  select s.*
    from public.spaces s
   where s.is_published and not s.is_removed
     and (auth.uid() is null or s.owner_id <> auth.uid())
     and not exists (
       select 1 from public.space_not_interested n
        where n.user_id = auth.uid() and n.space_id = s.id
     )
   order by (s.visit_count + s.like_count * 3) desc, random()
   limit greatest(1, least(60, limit_count));
$$;

/**
 * Where somebody has been, most recent first, one line per Space however
 * many times they have been back.
 */
create or replace function public.recently_visited(limit_count integer default 12)
returns setof public.spaces
language sql stable security definer set search_path = public as $$
  select s.*
    from public.spaces s
    join (
      select v.space_id, max(v.created_at) as last_seen
        from public.space_visits v
       where v.visitor_id = auth.uid()
       group by v.space_id
    ) seen on seen.space_id = s.id
   where s.is_published and not s.is_removed
   order by seen.last_seen desc
   limit greatest(1, least(60, limit_count));
$$;

grant execute on function public.hide_space, public.unhide_space,
  public.recently_visited to authenticated;
grant execute on function public.recommended_spaces to anon, authenticated;

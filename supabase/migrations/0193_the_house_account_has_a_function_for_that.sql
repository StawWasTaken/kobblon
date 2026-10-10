begin;

-- `flag_account` went looking for the house account by name
-- -----------------------------------------------------------------------
--
-- 0186 wrote `select id from profiles where username = 'kobblon'`, and
-- `kobblon_account()` has existed since 0068 to answer exactly that - and
-- answers it correctly for both names the house account has had, which the
-- hardcoded version does not. So on a Kobblon still signed in as
-- `kobbleston` the filter opened no ticket at all and said nothing about
-- it, because "no house account" is a case it is meant to pass over
-- quietly.
--
-- The lesson is small and it is the same one as the staff rank: when there
-- is already a function that answers the question, asking the table
-- directly is a second answer that will disagree one day.

create or replace function public.flag_account(target uuid, why text, said text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare house uuid;
begin
  if target is null then return; end if;

  -- Filed as Kobblon rather than as whoever received it: they have not
  -- asked for anything and may not have read it yet.
  house := public.kobblon_account();
  if house is null then return; end if;

  if exists (
    select 1 from public.reports r
     where r.target_type = 'profile' and r.target_id = target::text
       and r.reporter_id = house and r.status = 'open'
       and r.created_at > now() - interval '1 hour'
  ) then return; end if;

  insert into public.reports (reporter_id, target_type, target_id, reason, details)
  values (house, 'profile', target::text, 'harassment',
          left(why || E'\n\nWhat was written: ' || coalesce(said, ''), 1000));
end $$;

commit;

begin;

/*
 * Kobblon Klub: three tiers, and nothing that sells one yet.
 *
 * Staw: "i plan on adding Kobblon Klub its gonna be a subscription that
 * unlocks features ... yet theres no way to buy klub access, but there
 * will be 3 types: Klub Lite, Klub, Klub Life".
 *
 * So this is the part that can be built honestly today: what a tier **is**,
 * who has one, and one function that answers "does this person have Klub"
 * for every feature that will ever ask. What is deliberately **not** here
 * is a way to buy one - there is no payment, and a button that implies a
 * purchase the platform cannot take is the fake functionality this project
 * has a rule against.
 *
 * The tiers, in order, because almost every question about them is "at
 * least this much":
 *
 *   lite   the cheap one.
 *   klub   the ordinary one.
 *   life   free, for ever, and given by hand. Today only the house
 *          account has it; Staw may grant more.
 *
 * `membership` is a column on `profiles` rather than a table of
 * subscriptions, because today it answers one question and a table would
 * be a schema for a billing system nobody has written. When there is a
 * payment there will be a table of what was paid, and this column becomes
 * what that table decides - which is a migration, not a rewrite.
 *
 * `klub_until` is separate from the tier for the same reason a suspension
 * has an end date: a lapsed membership is a fact about when, not a
 * different tier. `life` ignores it, which is what makes it life.
 */

alter table public.profiles
  add column if not exists membership text not null default 'none'
    check (membership in ('none', 'lite', 'klub', 'life')),
  /* When it runs out. Null means it does not - which is `life`, and also
     a tier granted by hand with no end put on it. */
  add column if not exists klub_until timestamptz,
  add column if not exists klub_since timestamptz;

create index if not exists profiles_in_the_klub
  on public.profiles (membership) where membership <> 'none';

/**
 * Which tier somebody actually has right now.
 *
 * The one place that knows a lapsed membership is not a membership. Every
 * feature asks this rather than reading the column, because reading the
 * column is how a cancelled subscription keeps working for a month.
 *
 * Returns 'none', 'lite', 'klub' or 'life'.
 */
create or replace function public.klub_of(target uuid)
returns text
language sql stable security definer
set search_path = public, extensions as $$
  select case
    when p.membership = 'none' then 'none'
    when p.membership = 'life' then 'life'
    when p.klub_until is null or p.klub_until > now() then p.membership
    else 'none'
  end
  from public.profiles p
 where p.id = target
$$;

grant execute on function public.klub_of(uuid) to anon, authenticated;

/**
 * Whether somebody is in the Klub at all, at a tier or better.
 *
 * `at_least` takes a tier name and the ranking is the obvious one, so a
 * feature for everybody in the Klub asks for 'lite' and one for the two
 * paid tiers above it asks for 'klub'. Written as a ranking rather than a
 * list of names because `in ('klub', 'life')` repeated at thirty call
 * sites is thirty places to forget a tier the day a fourth one exists.
 */
create or replace function public.in_the_klub(
  target uuid default auth.uid(), at_least text default 'lite'
)
returns boolean
language sql stable security definer
set search_path = public, extensions as $$
  select case public.klub_of(target)
           when 'life' then 3 when 'klub' then 2 when 'lite' then 1 else 0
         end
       >= case at_least
            when 'life' then 3 when 'klub' then 2 else 1
          end
$$;

grant execute on function public.in_the_klub(uuid, text) to anon, authenticated;

/**
 * Putting somebody in the Klub, or taking them out, by hand.
 *
 * A superadmin's, and the only way in until there is a payment. `until` is
 * null for no end date; a tier of 'life' ignores it entirely, because a
 * membership for life with an end date on it is two things disagreeing.
 */
create or replace function public.set_klub(
  target uuid, tier text, until timestamptz default null
)
returns text
language plpgsql security definer
set search_path = public, extensions as $$
declare was text;
begin
  perform public.require_superadmin();

  if tier not in ('none', 'lite', 'klub', 'life') then
    raise exception 'A membership is none, lite, klub or life.';
  end if;

  select membership into was from public.profiles where id = target;
  if was is null then
    raise exception 'There is no account with that number.';
  end if;

  update public.profiles
     set membership = tier,
         klub_until = case when tier in ('none', 'life') then null else until end,
         klub_since = case
           when tier = 'none' then null
           when was = 'none' then now()
           else coalesce(klub_since, now())
         end
   where id = target;

  perform public.write_admin_log(
    'klub', target,
    jsonb_build_object(
      'who', (select username from public.profiles where id = target),
      'from', was, 'to', tier, 'until', until));

  if tier <> 'none' then
    insert into public.notifications (user_id, kind, body)
    values (target, 'system',
            'You are in the Kobblon Klub'
            || case when tier = 'life' then ', for life.' else '.' end);
  end if;

  return tier;
end $$;

revoke all on function public.set_klub(uuid, text, timestamptz) from public;
grant execute on function public.set_klub(uuid, text, timestamptz) to authenticated;

/*
 * The house account has Klub Life, which is what Staw asked for: "for now
 * only the kobblon account will have klub life, its a tier that is free and
 * for life".
 */
update public.profiles
   set membership = 'life', klub_until = null, klub_since = coalesce(klub_since, now())
 where id = public.kobblon_account();

commit;

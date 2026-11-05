begin;

/*
 * Four things, and the first one is a trap worth writing down.
 *
 * ------------------------------------------------------------------
 * 1. A post could not be taken down. At all. By anybody.
 * ------------------------------------------------------------------
 *
 * Removing a post is `update community_posts set is_removed = true`, and
 * it failed with **"new row violates row-level security policy"** - the
 * message you get when the write is refused rather than the row not being
 * found. The update policy was not the problem: it allows the author and
 * anybody who can moderate the wall, and it allows them on the old row and
 * the new one alike.
 *
 * The *read* policy was:
 *
 *     using (not is_removed and ... the community is public ...)
 *
 * Postgres applies a table's SELECT policies to the new row of an UPDATE
 * as well. So the row this statement writes - `is_removed = true` - is a
 * row the author may no longer read, and the write is refused for that
 * reason and no other. Editing the same post worked, which is what made
 * it look like a permission problem with removing specifically.
 *
 * The shape to remember: **a soft delete that writes a row the read policy
 * forbids.** Every `is_removed`, `is_hidden`, `is_archived` column guarded
 * by a read policy that filters on it has this waiting in it, and it never
 * shows up until somebody tries to use the feature, because the insert and
 * the edit both pass.
 *
 * The fix is the door rather than the policy: one `security definer`
 * function that decides who may take a post down and then does it. Keeping
 * the read policy as it is means a removed post stays gone for everybody,
 * which is the point of removing it.
 */

create or replace function public.remove_community_post(target bigint)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare post public.community_posts%rowtype;
begin
  select * into post from public.community_posts where id = target;
  if post.id is null then raise exception 'No such post.'; end if;
  if post.is_removed then return; end if;

  /*
   * The same three the wall already draws the button for, so what is
   * offered and what is allowed are one answer: your own post, anybody who
   * moderates the wall, and an announcement in the hands of somebody who
   * manages the Community.
   */
  if not (
    post.author_id = auth.uid()
    or public.community_can(post.community_id, 'can_moderate_wall')
    or (post.is_announcement
        and public.community_can(post.community_id, 'can_manage_community'))
  ) then
    raise exception 'That is not yours to take down.' using errcode = '42501';
  end if;

  update public.community_posts set is_removed = true where id = target;

  if post.author_id <> auth.uid() then
    perform public.log_community(post.community_id, 'post_removed', post.body);
  end if;
end $$;

revoke all on function public.remove_community_post(bigint) from public;
grant execute on function public.remove_community_post(bigint) to authenticated;

/*
 * ------------------------------------------------------------------
 * 2. A main Community, shown on a profile and pinned in the rail.
 * ------------------------------------------------------------------
 *
 * Staw: "on communities in the more button we can click on a button to
 * make the community primary which displays it as your main community on
 * your profile and in your communities sidebar".
 *
 * It is a column on the profile rather than a flag on the membership,
 * because there is one of them and it belongs to the person: a flag per
 * membership is a thing that can be true twice.
 */
alter table public.profiles
  add column if not exists primary_community uuid
    references public.communities(id) on delete set null;

comment on column public.profiles.primary_community is
  'The one shown on their profile and pinned in their rail. Theirs to pick.';

/*
 * The flag is the whole of why this works, and the first version of this
 * file did not have it.
 *
 * `security definer` gives this function the rights to write the column.
 * `guard_profile_update` then pinned it straight back, because the guard
 * asks `auth.uid()` who is doing this and `auth.uid()` is still the caller -
 * `security definer` changes a function's rights, not who it reports as.
 * The call returned without an error and the column did not move, which is
 * the exact shape of the worst bug this platform has had.
 *
 * It survived the first check for the reason the project has written down
 * twice now: the check ran as @kobblon, who is an admin, and the guard lets
 * an admin past before it pins anything. The one identity where the bug
 * cannot happen was the one that was tested. Running the same three lines
 * as an ordinary account is what found it.
 *
 * So: raise the flag, write, lower it. The guard honours the flag and
 * nothing else, and it is transaction-local, so it cannot outlive the
 * statement that set it.
 */
create or replace function public.set_primary_community(target uuid)
returns void language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  -- Nothing, which is how somebody takes it back off their profile.
  if target is null then
    perform set_config('kobbleston.community', 'on', true);
    update public.profiles set primary_community = null where id = me;
    perform set_config('kobbleston.community', 'off', true);
    return;
  end if;

  if not exists (
    select 1 from public.community_members
     where community_id = target and user_id = me
  ) then
    raise exception 'Join a Community before making it your main one.';
  end if;

  if exists (select 1 from public.communities
              where id = target and (is_removed or not is_public)) then
    raise exception 'That Community cannot be shown on a profile.';
  end if;

  perform set_config('kobbleston.community', 'on', true);
  update public.profiles set primary_community = target where id = me;
  perform set_config('kobbleston.community', 'off', true);
end $$;

revoke all on function public.set_primary_community(uuid) from public;
grant execute on function public.set_primary_community(uuid) to authenticated;

/*
 * ------------------------------------------------------------------
 * 3. Sending Brix to somebody, with Kobblon's cut.
 * ------------------------------------------------------------------
 *
 * Staw: "add a 'Send Brix' feature but the kobblon account also takes a
 * share of 5% of the stuff (or the normal kobblon tax) u send to another
 * user".
 *
 * Five, not the thirty-five a sale pays, and its own function rather than
 * a second caller of `platform_share` - they are different numbers for
 * different things and tying them together means one of them changes by
 * accident one day.
 *
 * The sender is charged the amount; the receiver gets the amount less the
 * cut. What somebody types is what leaves their balance, which is the
 * arrangement that cannot surprise anybody.
 */
/*
 * Two new words for the ledger.
 *
 * `pixel_transactions.kind` is a check constraint listing every way Brix
 * have ever moved, and a gift between two people was not one of them. The
 * first version of this file did not notice, because the function compiled,
 * applied twice, and only failed on the statement that actually sends
 * something - which is a thing nobody finds until somebody uses the
 * feature.
 *
 * The house's own cut rides on `platform_fee`, which already exists and
 * already means exactly this.
 */
alter table public.pixel_transactions
  drop constraint if exists pixel_transactions_kind_check;
alter table public.pixel_transactions
  add constraint pixel_transactions_kind_check check (kind = any (array[
    'signup_grant', 'daily', 'purchase', 'sale', 'refund', 'admin',
    'username_change', 'donation', 'ad_budget', 'ad_refund', 'ad_earning',
    'listing_fee', 'listing_refund', 'platform_fee', 'burn', 'code',
    'item_edit', 'gift_sent', 'gift_received'
  ]));

create or replace function public.sending_share() returns integer
language sql immutable as $$ select 5 $$;

grant execute on function public.sending_share to anon, authenticated;

create or replace function public.send_brix(
  to_user uuid, amount integer, note text default null
)
returns table (sent integer, cut integer, arrived integer, balance integer)
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  house uuid := public.kobbleston_account();
  them public.profiles%rowtype;
  mine integer;
  fee integer;
  kept integer;
  left_with integer;
  words text := nullif(btrim(coalesce(note, '')), '');
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if public.is_guest() then
    raise exception 'Guests cannot send Brix. Make an account and you can.';
  end if;
  if to_user = me then raise exception 'That is your own account.'; end if;
  if coalesce(amount, 0) < 10 then raise exception 'Ten Brix is the least you can send.'; end if;
  if amount > 100000 then raise exception 'A hundred thousand is the most in one go.'; end if;

  select * into them from public.profiles where id = to_user;
  if them.id is null then raise exception 'No such account.'; end if;
  if them.is_guest then raise exception 'A guest account cannot be sent Brix.'; end if;

  -- Blocking is about not hearing from somebody, and money is hearing from
  -- somebody. Both directions: neither of them wants this.
  if exists (
    select 1 from public.blocks
     where (blocker_id = me and blocked_id = to_user)
        or (blocker_id = to_user and blocked_id = me)
  ) then
    raise exception 'You cannot send Brix to them.';
  end if;

  select pixels into mine from public.profiles where id = me;
  if coalesce(mine, 0) < amount then
    raise exception 'You do not have that much.';
  end if;

  fee := round(amount * public.sending_share() / 100.0)::integer;
  kept := amount - fee;

  left_with := public.move_pixels(me, -amount, 'gift_sent',
    'Sent to @' || them.username || coalesce(': ' || words, ''));
  perform public.move_pixels(to_user, kept, 'gift_received',
    'From @' || (select username from public.profiles where id = me)
      || coalesce(': ' || words, ''));

  if fee > 0 and house is not null and house <> to_user and house <> me then
    perform public.move_pixels(house, fee, 'platform_fee', 'Cut of a gift');
  end if;

  insert into public.notifications (user_id, kind, actor_id, body)
  values (
    to_user, 'system', me,
    '@' || (select username from public.profiles where id = me)
      || ' sent you ' || kept || ' Brix'
      || coalesce(': ' || words, '.')
  );

  return query select amount, fee, kept, left_with;
end $$;

revoke all on function public.send_brix(uuid, integer, text) from public;
grant execute on function public.send_brix(uuid, integer, text) to authenticated;

/*
 * ------------------------------------------------------------------
 * 4. The guard, with the one new column nobody may set directly.
 * ------------------------------------------------------------------
 *
 * Written out from 0257 rather than patched blind, both trusted flags
 * still here. 0215 lost one doing exactly this and suspensions stopped
 * working for four weeks without an error anywhere.
 *
 * `primary_community` is pinned because `set_primary_community` is what
 * checks that somebody is actually in the Community they are putting on
 * their profile.
 */
create or replace function public.guard_profile_update()
returns trigger language plpgsql security definer
  set search_path = public, extensions as $$
begin
  if auth.uid() is null then return new; end if;

  if current_setting('kobbleston.money', true) = 'on' then
    return new;
  end if;

  if current_setting('kobbleston.standing', true) = 'on' then
    return new;
  end if;

  -- `set_primary_community` raised this, having checked that the person is
  -- actually in the Community. Without it, that function is a privileged
  -- write undone by a guard whose subject is identity.
  if current_setting('kobbleston.community', true) = 'on' then
    return new;
  end if;

  if public.is_admin() then return new; end if;

  -- Standing: who you are to Kobblon. Never yours to set.
  new.is_superadmin := old.is_superadmin;
  new.is_admin      := old.is_admin;
  new.is_moderator  := old.is_moderator;
  new.is_verified   := old.is_verified;
  new.is_suspended  := old.is_suspended;
  new.is_guest      := old.is_guest;

  new.suspended_until := old.suspended_until;

  -- Money. It moves through move_pixels, which writes a ledger row beside
  -- every change; a direct write would move the balance and leave no trace.
  new.pixels := old.pixels;

  -- Identity the site assigns rather than the person.
  new.content_id := old.content_id;
  new.created_at := old.created_at;

  -- Whether there is an address behind this account, and whether the site
  -- is still waiting for a password.
  new.has_email         := old.has_email;
  new.must_set_password := old.must_set_password;

  -- Theirs to pick, through the function that checks they are in it.
  new.primary_community := old.primary_community;

  return new;
end;
$$;

/*
 * ------------------------------------------------------------------
 * 5. An event that has been and gone.
 * ------------------------------------------------------------------
 *
 * Staw: "when events are finished they still display in the about part of
 * the community but then disappears after a day and gets stored into the
 * past events in the events tab".
 *
 * Both of those are the same question asked of a timestamp, so the answer
 * is given here rather than worked out twice in the browser: `is_over` is
 * whether it has finished, and `just_over` is whether it finished recently
 * enough that the About page should still be showing it.
 *
 * An event with no end is over when it starts. That is not a guess about
 * how long it ran; it is the only honest reading of a row that never said.
 */
drop function if exists public.community_events_list(uuid, boolean);
create function public.community_events_list(target uuid, upcoming_only boolean default false)
returns table (
  id uuid,
  content_id bigint,
  title text,
  subtitle text,
  description text,
  cover_url text,
  space_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  is_cancelled boolean,
  attending_count integer,
  i_am_going boolean,
  community_slug text,
  community_name text,
  community_icon text,
  /* Finished, and finished within the last day. */
  is_over boolean,
  just_over boolean
)
language sql stable security definer set search_path = public, extensions as $$
  select e.id, e.content_id, e.title, e.subtitle, e.description, e.cover_url, e.space_id,
         e.starts_at, e.ends_at, e.is_cancelled, e.attending_count,
         exists (select 1 from public.event_attendance a
                  where a.event_id = e.id and a.user_id = auth.uid()),
         c.slug, c.name, c.icon_url,
         coalesce(e.ends_at, e.starts_at) <= now(),
         coalesce(e.ends_at, e.starts_at) <= now()
           and coalesce(e.ends_at, e.starts_at) > now() - interval '1 day'
    from public.community_events e
    join public.communities c on c.id = e.community_id
   where e.community_id = target
     and (not upcoming_only or coalesce(e.ends_at, e.starts_at) > now())
   order by e.starts_at desc;
$$;

grant execute on function public.community_events_list to anon, authenticated;

commit;

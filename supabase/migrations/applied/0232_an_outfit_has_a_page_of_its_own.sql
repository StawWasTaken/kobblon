begin;

/*
 * An outfit, on its own page.
 *
 * Staw: "the outfits on the catalog should be in 3d too and have their own
 * asset page like others". The second half is this file.
 *
 * Everything else in the Catalog has a page because `avatar_item_page`
 * exists: one reader that answers "what is this", separately from
 * `avatar_shelf`, which answers "what is for sale". An outfit had only the
 * shelf row - a name, a price and four piece names - so there was nowhere
 * to send somebody who wanted to look before spending, and nowhere for a
 * link to a saved look to point.
 *
 * Taken by `content_id` rather than by uuid, because that is the number the
 * rest of the Catalog puts in its addresses and the one a person can read
 * off a card. The uuid is handed back so everything that acts on an outfit -
 * buying it, drawing it with `outfit_look` - still has it.
 *
 * `pieces` carries each piece's own `content_id` and `kind` so the page can
 * link every line of the outfit to that item's own page. That was the thing
 * the shelf row could not do: it listed four names and none of them went
 * anywhere.
 */
create or replace function public.outfit_page(tag bigint)
returns table (
  id uuid,
  content_id bigint,
  name text,
  price integer,
  /** What it actually costs this person: the pieces they do not own yet. */
  costs integer,
  owned_already integer,
  how_many integer,
  maker_share integer,
  created_at timestamptz,
  owner_id uuid,
  owner_username text,
  owner_display_name text,
  owner_avatar_url text,
  owner_is_verified boolean,
  owner_is_staff boolean,
  /** True when it is yours, so the page offers Wear rather than Buy. */
  mine boolean,
  pieces jsonb
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (select auth.uid() as who),
  one as (
    select o.*
      from public.outfits o
     where o.content_id = tag
       and not o.is_removed
       and (o.is_public or o.owner_id = (select who from me))
  ),
  bits as (
    select
      oi.outfit_id,
      i.id as item_id,
      i.content_id as item_content_id,
      i.kind,
      oi.slot,
      i.name,
      i.price,
      i.image_path,
      i.image_bucket,
      i.preview_path,
      exists (
        select 1 from public.avatar_owned w
         where w.user_id = (select who from me) and w.item_id = i.id
      ) as owned
      from public.outfit_items oi
      join public.avatar_items i on i.id = oi.item_id and not i.is_removed
     where oi.outfit_id = (select id from one)
  )
  select
    one.id,
    one.content_id,
    one.name,
    one.price,
    /*
     * The pieces already owned are not charged for again. The same sum
     * `outfit_shelf` does, and the same sum `buy_outfit` does when it
     * actually takes the money - said in all three places because a page
     * that quotes a different number from the one charged is worse than a
     * page with no number on it.
     */
    coalesce((select sum(b.price)::integer from bits b where not b.owned), 0),
    coalesce((select count(*)::integer from bits b where b.owned), 0),
    coalesce((select count(*)::integer from bits b), 0),
    one.maker_share,
    one.created_at,
    p.id, p.username, p.display_name, p.avatar_url,
    coalesce(p.is_verified, false),
    coalesce(p.has_staff_badge or p.is_moderator or p.is_admin, false),
    one.owner_id = (select who from me),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'item_id', b.item_id,
        'content_id', b.item_content_id,
        'kind', b.kind,
        'slot', b.slot,
        'name', b.name,
        'price', b.price,
        'image_path', b.image_path,
        'image_bucket', b.image_bucket,
        'preview_path', b.preview_path,
        'owned', b.owned
      ) order by b.name)
      from bits b
    ), '[]'::jsonb)
  from one
  join public.profiles p on p.id = one.owner_id;
$$;

grant execute on function public.outfit_page(bigint) to anon, authenticated;

commit;

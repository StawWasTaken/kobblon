begin;

/*
 * What to put in front of somebody.
 *
 * Staw: "under that i want the catalog recommended items ... we also want
 * to implement an algorithm to the catalog + that area in the my avatar
 * page". So there is one reader and both places use it, because two
 * different ideas of what somebody wants is how a shop recommends a hat on
 * one page and the same person a skirt on the next.
 *
 * It is a scored ranking, not a model, and every part of the score is a
 * number this database already holds. Said out loud because a
 * recommendation nobody can explain is one nobody can fix:
 *
 *   **Fills a gap.** The biggest weight by a distance. Somebody wearing no
 *   trousers wants trousers more than they want a fourth hat, and that is
 *   the one thing a wardrobe knows about a person that a shop does not.
 *
 *   **Affordable.** Something they can buy today is worth more than
 *   something they cannot. Not a hard filter: seeing what you are saving
 *   for is part of a shop, so dear things are pushed down rather than out.
 *
 *   **Popular, and liked.** How many other people took it, and how many
 *   starred it. Capped, because without a cap the same six things sit at
 *   the top of everybody's page for ever and nothing new is ever seen.
 *
 *   **Like what they already wear.** How many things of that kind they own
 *   already, also capped. Somebody with nine hats likes hats.
 *
 *   **New.** A small nudge for the last fortnight, so the shelf moves.
 *
 * And one rule that is not a score: **at most two of any one slot**. A list
 * of twelve hats is a correct answer to the sum and a useless answer to the
 * person, which is the oldest failure in recommending anything.
 *
 * Signed out, the first four do nothing - there is no wardrobe and no
 * balance to read - and what is left is "popular, liked and new", which is
 * the right answer for somebody we know nothing about.
 *
 * Its columns are `avatar_shelf`'s, exactly, so every card that draws a
 * Catalog item draws these with no new code.
 */
create or replace function public.recommended_avatar_items(how_many integer default 12)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text,
  description text, price integer,
  image_path text, image_bucket text, preview_path text,
  mesh_preview_path text, sells_until timestamptz,
  mesh_path text, texture_path text,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_is_verified boolean, creator_is_staff boolean,
  created_at timestamptz,
  owned boolean, taken integer, stars integer, starred boolean
)
language sql stable security definer
set search_path = public, extensions as $$
  with me as (
    select
      auth.uid() as who,
      coalesce((select p.pixels from public.profiles p where p.id = auth.uid()), 0) as purse
  ),
  /* Which sockets are empty, which is the strongest thing we know. */
  filled as (
    select distinct w.slot
      from public.avatar_worn w
     where w.user_id = (select who from me)
  ),
  /* How much of each kind they already own, as a taste. */
  taste as (
    select i.kind, count(*)::int as how_many
      from public.avatar_owned o
      join public.avatar_items i on i.id = o.item_id
     where o.user_id = (select who from me)
     group by i.kind
  ),
  pool as (
    select
      i.*,
      c.username, c.display_name, c.is_verified, c.is_admin, c.is_moderator,
      m.file_path as mesh_file, m.preview_path as mesh_preview,
      t.file_path as texture_file,
      (select count(*)::int from public.avatar_owned o
        where o.item_id = i.id and o.user_id <> i.creator_id) as taken_count,
      (select count(*)::int from public.avatar_favourites f
        where f.item_id = i.id) as star_count
      from public.avatar_items i
      join public.profiles c on c.id = i.creator_id and not c.is_suspended
      left join public.assets m on m.id = i.mesh_id
      left join public.assets t on t.id = i.texture_id
     where i.status = 'approved' and i.is_public and not i.is_removed
       /* Not something they already have, and not something still selling
          that has stopped selling. */
       and not exists (
         select 1 from public.avatar_owned o
          where o.item_id = i.id and o.user_id = (select who from me)
       )
       and (i.sells_until is null or i.sells_until > now())
  ),
  scored as (
    select
      pool.*,
      (
        /* The empty socket, which is worth more than everything else. */
        case
          when (select who from me) is null then 0
          when pool.slot is null then 0
          when pool.slot in (select slot from filled) then 0
          else 60
        end
        /* Within reach today, or a long way out of it. */
        + case
            when (select who from me) is null then 0
            when pool.price <= (select purse from me) then 20
            when pool.price <= (select purse from me) * 2 then 5
            else -15
          end
        /* Other people took it, capped so the same six do not win for ever. */
        + least(pool.taken_count, 40)
        + least(pool.star_count * 2, 30)
        /* The kind they keep buying. */
        + coalesce(
            (select least(taste.how_many, 8) * 3 from taste where taste.kind = pool.kind),
            0)
        /* New, for a fortnight. */
        + case when pool.created_at > now() - interval '14 days' then 12 else 0 end
      ) as score
      from pool
  ),
  /*
   * At most two of a slot. `row_number` over the slot rather than a
   * `distinct on`, because we want the best two and not the best one.
   */
  spread as (
    select scored.*,
           row_number() over (
             partition by coalesce(scored.slot, scored.kind)
             order by scored.score desc, scored.created_at desc
           ) as nth
      from scored
  )
  select
    s.id, s.content_id, s.kind, s.slot, s.name, s.description, s.price,
    s.image_path, s.image_bucket, s.preview_path,
    s.mesh_preview, s.sells_until,
    s.mesh_file, s.texture_file,
    s.creator_id, s.username, s.display_name,
    coalesce(s.is_verified, false) or coalesce(s.is_admin, false),
    coalesce(s.is_admin, false) or coalesce(s.is_moderator, false),
    s.created_at,
    false,
    s.taken_count,
    s.star_count,
    exists (
      select 1 from public.avatar_favourites f
       where f.item_id = s.id and f.user_id = (select who from me)
    )
    from spread s
   where s.nth <= 2
   order by s.score desc, s.created_at desc
   limit least(greatest(coalesce(how_many, 12), 1), 40);
$$;

grant execute on function public.recommended_avatar_items(integer) to anon, authenticated;

commit;

begin;

-- Narrowing the Catalog, and looking after what you have made.
--
-- Staw wants the Catalog to filter by who made a thing and to sort the way
-- the Marketplace does, and Things to Wear to let somebody publish, take
-- down, edit, archive or delete their own.
--
-- Two notes on what is deliberately not here.
--
-- **There is no "best rated".** The Marketplace has ratings; avatar items do
-- not, because nobody has rated one. A sort that silently falls back to
-- something else is worse than a sort that is not offered - it looks like it
-- worked. When ratings exist for these, the sort can exist too.
--
-- **Deleting and archiving are different things, and the difference is other
-- people.** Archiving takes a thing off the shelf and leaves it on everybody
-- already wearing it. Deleting is only allowed while nobody else has it:
-- anything else would take clothes off people who paid for them.

-- ------------------------------------------------------------- the shelf

/*
 * Both signatures: the one 0116 left and the one this file makes.
 *
 * Dropping only the old one works perfectly the first time and fails the
 * second with "function avatar_shelf already exists with same argument
 * types" - and these are applied by hand, where running a file twice to be
 * sure is exactly what a person does.
 */
drop function if exists public.avatar_shelf(text, text, integer);
drop function if exists public.avatar_shelf(text, text, integer, text, text);

create function public.avatar_shelf(
  of_kind text default null,
  term text default null,
  how_many integer default 60,
  /*
   * 'anybody', 'kobblon', or a username. A name rather than an id, because
   * it comes from a box somebody typed in.
   */
  made_by text default null,
  /* 'newest', 'oldest', 'cheapest', 'dearest', 'taken'. */
  sort_by text default 'newest'
)
returns table(
  id uuid, content_id bigint, kind text, slot text, name text,
  description text, price integer, image_path text, image_bucket text,
  mesh_path text, texture_path text, creator_id uuid, creator_username text,
  creator_display_name text, creator_is_verified boolean,
  created_at timestamptz, owned boolean, taken integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, m.file_path, t.file_path,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
         i.created_at,
         exists (select 1 from public.avatar_owned o
                  where o.item_id = i.id and o.user_id = auth.uid()),
         (select count(*)::int from public.avatar_owned o
           where o.item_id = i.id and o.user_id <> i.creator_id)
    from public.avatar_items i
    join public.profiles c on c.id = i.creator_id and not c.is_suspended
    left join public.assets m on m.id = i.mesh_id
    left join public.assets t on t.id = i.texture_id
   where i.status = 'approved' and i.is_public and not i.is_removed
     and (of_kind is null or i.kind = of_kind)
     and (term is null or btrim(term) = '' or i.name ilike '%' || btrim(term) || '%')
     and (
       made_by is null or made_by = 'anybody'
       or (made_by = 'kobblon' and coalesce(c.is_admin, false))
       or lower(c.username) = lower(ltrim(made_by, '@'))
     )
   order by
     case when sort_by = 'cheapest' then i.price end asc nulls last,
     case when sort_by = 'dearest'  then i.price end desc nulls last,
     case when sort_by = 'oldest'   then i.created_at end asc nulls last,
     case when sort_by = 'taken' then
       (select count(*) from public.avatar_owned o
         where o.item_id = i.id and o.user_id <> i.creator_id) end desc nulls last,
     -- Newest, and the tie-breaker for every other sort: two things at the
     -- same price should not come back in a different order each time.
     i.created_at desc
   limit least(greatest(coalesce(how_many, 60), 1), 120);
$$;

grant execute on function public.avatar_shelf to anon, authenticated;

-- -------------------------------------------------------- minding your own

/**
 * Changing what you wrote about a thing, and what it costs.
 *
 * Not what it *is*: the kind, the slot and the picture stay as they were.
 * Somebody who has bought a hat has bought that hat, and a maker who could
 * swap the picture afterwards could sell one thing and deliver another.
 */
create or replace function public.edit_avatar_item(
  target uuid, new_name text, about text, cost integer
) returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  item record;
  rule record;
  verdict record;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  select * into item from public.avatar_items where id = target and creator_id = me;
  if item.id is null then raise exception 'That is not yours.'; end if;
  if item.is_removed then raise exception 'That has been archived.'; end if;

  select * into rule from public.avatar_rules() where kind = item.kind;
  if cost is null or cost < rule.least_price then
    raise exception 'A % sells for at least % Brix.', item.kind, rule.least_price;
  end if;

  select * into verdict from public.screen_text(
    coalesce(new_name, '') || ' ' || coalesce(about, ''));
  if verdict.decision = 'block' then
    raise exception 'That name or description is not allowed here.';
  end if;

  /*
   * A changed name goes back through screening, the same as an upload. The
   * alternative is uploading something harmless and renaming it afterwards,
   * which is the way round every name check there is.
   */
  update public.avatar_items
     set name = btrim(new_name),
         description = nullif(btrim(coalesce(about, '')), ''),
         price = cost,
         status = case when verdict.decision = 'review' then 'pending'::public.moderation_status
                       else status end,
         updated_at = now()
   where id = target;
end;
$$;

/**
 * Archiving: off the shelf, still on everybody wearing it.
 *
 * Reversible, because somebody taking their own work down for a week and
 * putting it back is an ordinary thing to want.
 */
create or replace function public.archive_avatar_item(target uuid, archived boolean)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;
  update public.avatar_items
     set is_removed = archived,
         is_public = case when archived then false else is_public end,
         updated_at = now()
   where id = target and creator_id = me;
  if not found then raise exception 'That is not yours.'; end if;
end;
$$;

/**
 * Deleting, which is only yours to do while it is only yours.
 *
 * The moment anybody else has one, deleting it would take it off them -
 * something they chose, and in most cases paid for. Archiving is what that
 * person wants instead, and the refusal says so.
 */
create or replace function public.delete_avatar_item(target uuid)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  others integer;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if not exists (select 1 from public.avatar_items
                  where id = target and creator_id = me) then
    raise exception 'That is not yours.';
  end if;

  select count(*) into others from public.avatar_owned o
   where o.item_id = target and o.user_id <> me;

  if others > 0 then
    -- "1 person already have this" is what counting without conjugating
    -- gives you. Both halves move together or neither should.
    raise exception
      '% % this, so it cannot be deleted. Archive it instead, and they keep it.',
      others,
      case when others = 1 then 'person already has' else 'people already have' end;
  end if;

  delete from public.avatar_items where id = target;
end;
$$;

grant execute on function public.edit_avatar_item    to authenticated;
grant execute on function public.archive_avatar_item to authenticated;
grant execute on function public.delete_avatar_item  to authenticated;

commit;

begin;

-- Two things, both about what a page is allowed to say.

-- 1. A name carries two marks, so a reader has to hand back two facts.
--
-- Staw: the tick and the Kobblon k are part of a display name, not an
-- ornament beside it, and they go wherever the name goes. The Catalog's
-- readers handed back `creator_is_verified` only, and that column already
-- folds admin into verified - so an admin read as verified and there was no
-- way to know to draw the k. Two facts, kept apart, because they mean
-- different things: verified is "Kobblon vouches for this account", staff is
-- "this account is Kobblon".

-- Dropped rather than replaced: a returned row that grows is a different
-- row type, and `create or replace` refuses it. Both readers, by their full
-- signature, because a drop that names the wrong arity silently leaves the
-- old one behind - which is how `list_avatar_item` became ambiguous.
drop function if exists public.avatar_shelf(text, text, integer, text, text);
drop function if exists public.avatar_item_page(bigint);

create function public.avatar_shelf(of_kind text DEFAULT NULL::text, term text DEFAULT NULL::text, how_many integer DEFAULT 60, made_by text DEFAULT NULL::text, sort_by text DEFAULT 'newest'::text)
 returns table (
   id uuid, content_id bigint, kind text, slot text, name text, description text,
   price integer, image_path text, image_bucket text, preview_path text,
   sells_until timestamptz, mesh_path text, texture_path text,
   creator_id uuid, creator_username text, creator_display_name text,
   creator_is_verified boolean, creator_is_staff boolean,
   created_at timestamptz, owned boolean, taken integer
 )
 language sql stable security definer
 set search_path to 'public', 'extensions'
as $function$
  select i.id, i.content_id, i.kind, i.slot, i.name, i.description, i.price,
         i.image_path, i.image_bucket, i.preview_path, i.sells_until,
         m.file_path, t.file_path,
         c.id, c.username, c.display_name,
         coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
         coalesce(c.is_admin, false) or coalesce(c.is_moderator, false),
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
     i.created_at desc
   limit least(greatest(coalesce(how_many, 60), 1), 120);
$function$;

grant execute on function public.avatar_shelf to anon, authenticated;

create function public.avatar_item_page(wanted bigint)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text,
  description text, price integer,
  image_path text, image_bucket text, preview_path text,
  sells_until timestamptz, mesh_path text, mesh_format text, texture_path text,
  creator_id uuid, creator_username text, creator_display_name text,
  creator_is_verified boolean, creator_is_staff boolean, created_at timestamptz,
  owned boolean, worn boolean, mine boolean, is_public boolean, taken integer
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    i.id, i.content_id, i.kind, i.slot, i.name,
    i.description, i.price,
    i.image_path, i.image_bucket, i.preview_path,
    i.sells_until,
    m.file_path,
    lower(split_part(m.file_path, '.', array_length(string_to_array(m.file_path, '.'), 1))),
    t.file_path,
    c.id, c.username, c.display_name,
    coalesce(c.is_verified, false) or coalesce(c.is_admin, false),
    coalesce(c.is_admin, false) or coalesce(c.is_moderator, false),
    i.created_at,
    exists (select 1 from public.avatar_owned o
             where o.item_id = i.id and o.user_id = auth.uid()),
    exists (select 1 from public.avatar_worn w
             where w.item_id = i.id and w.user_id = auth.uid()),
    i.creator_id = auth.uid(),
    i.is_public,
    (select count(*)::int from public.avatar_owned o
      where o.item_id = i.id and o.user_id <> i.creator_id)
  from public.avatar_items i
  join public.profiles c on c.id = i.creator_id and not c.is_suspended
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  where i.content_id = wanted
    and not i.is_removed
    and (i.status = 'approved' or i.creator_id = auth.uid());
$$;

grant execute on function public.avatar_item_page to anon, authenticated;

-- 2. One colour everywhere is fine if something is being worn.
--
-- 0123 refused a body whose six parts were all one colour, because that is
-- the body that reads as bare skin. Staw's correction: what makes somebody
-- naked is wearing nothing, not having one colour - so the rule is about
-- the trousers, not the palette. Wearing trousers, any colour scheme is
-- allowed, including all six the same.
--
-- The check reads what is worn at the moment the colours are set, which is
-- the right moment for it and not the only one that matters: `take_off_slot`
-- has to refuse taking trousers off a body that is all one colour, or the
-- rule is a door with a wall missing beside it. That is below.

create or replace function public.one_colour_all_over(colours jsonb)
returns boolean
language sql immutable
set search_path = public, extensions as $$
  select colours is not null
     and (select count(distinct lower(value)) from jsonb_each_text(colours)) = 1
     and (select count(*) from jsonb_each_text(colours)) = 6;
$$;

create or replace function public.set_body_colours(colours jsonb)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  part text;
  value text;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if colours is not null then
    if jsonb_typeof(colours) <> 'object' then
      raise exception 'Colours come as an object.';
    end if;
    for part, value in select * from jsonb_each_text(colours) loop
      if part not in ('Head', 'Torso', 'LeftArm', 'RightArm', 'LeftLeg', 'RightLeg') then
        raise exception 'There is no body part called %.', part;
      end if;
      if value !~* '^#[0-9a-f]{6}$' then
        raise exception 'A colour looks like #1b34e8.';
      end if;
    end loop;

    if public.one_colour_all_over(colours)
       and not exists (
         select 1 from public.avatar_worn w
          where w.user_id = me and w.slot = 'trousers'
       )
    then
      raise exception 'One colour from head to foot reads as wearing nothing. Put trousers on first, or keep a part different.';
    end if;
  end if;

  update public.profiles set body = colours where id = me;
end;
$$;

-- The wall beside the door: trousers cannot come off a body that is one
-- colour all over, because that is the same state by another route.
create or replace function public.take_off_slot(which text)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in first.'; end if;

  if which = 'trousers'
     and public.one_colour_all_over((select body from public.profiles where id = me))
  then
    raise exception 'Your body is one colour all over, so the trousers stay on. Change a colour first.';
  end if;

  delete from public.avatar_worn w where w.user_id = me and w.slot = which;
end;
$$;

grant execute on function public.set_body_colours to authenticated;
grant execute on function public.take_off_slot   to authenticated;

commit;

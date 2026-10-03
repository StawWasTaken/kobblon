begin;

-- Avatar items had no way out of 'pending'.
--
-- They are created pending, exactly like an upload, and that is right: a
-- shirt anybody can make is a picture anybody can put on a body, and it is
-- screened before anybody else sees it. What was missing is the other end.
-- Assets have `review_asset` and a worker that calls it; avatar items had
-- nothing at all, so every one ever made sat "Waiting to be screened" for
-- ever and the Catalog could never be published to.
--
-- Nothing a page calls decides this. The guard is the one `review_asset`
-- uses and for the same reason: with no JWT this is the review worker
-- running as the service role, and with one it has to be a moderator. An
-- item cannot screen itself and its maker cannot screen it either.

-- Who may screen one. Its own function so the queue and the decision cannot
-- drift apart, which is how a queue ends up showing somebody work they are
-- then refused.
create or replace function public.screens_avatar_items()
returns boolean
language sql stable security definer
set search_path = public, extensions as $$
  select coalesce(
    (select is_moderator or is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.screens_avatar_items to authenticated;

create or replace function public.review_avatar_item(
  target uuid,
  decision public.moderation_status,
  note text default null
)
returns void
language plpgsql security definer
set search_path = public, extensions as $$
begin
  -- Moderator or admin. `is_moderator()` reads one column and an admin does
  -- not necessarily have it set, which would have left the person who runs
  -- the place unable to screen anything - a button that refuses.
  if auth.uid() is not null and not public.screens_avatar_items() then
    raise exception 'That is not yours to screen.';
  end if;

  update public.avatar_items
     set status = decision,
         review_note = note,
         updated_at = now()
   where id = target;

  if not found then
    raise exception 'There is no such item.';
  end if;
end;
$$;

revoke execute on function public.review_avatar_item from anon;
-- Granted, and then refused inside unless it is a moderator: a signed-in
-- person has to be able to call it for a moderator to be able to, and the
-- decision about who may is made in one place rather than two.
grant execute on function public.review_avatar_item to authenticated;

-- What a moderator works through, oldest first, with enough to judge it by.
create or replace function public.avatar_review_queue(how_many integer default 50)
returns table (
  id uuid, content_id bigint, kind text, slot text, name text,
  description text, image_path text, image_bucket text, preview_path text,
  mesh_path text, texture_path text,
  creator_id uuid, creator_username text, created_at timestamptz
)
language sql stable security definer
set search_path = public, extensions as $$
  select
    i.id, i.content_id, i.kind, i.slot, i.name,
    i.description, i.image_path, i.image_bucket, i.preview_path,
    m.file_path, t.file_path,
    i.creator_id, p.username, i.created_at
  from public.avatar_items i
  left join public.assets m on m.id = i.mesh_id
  left join public.assets t on t.id = i.texture_id
  left join public.profiles p on p.id = i.creator_id
  where i.status = 'pending'
    and not i.is_removed
    and public.screens_avatar_items()
  order by i.created_at
  limit least(greatest(how_many, 1), 200);
$$;

grant execute on function public.avatar_review_queue to authenticated;

commit;

-- Content on Kobbleston Create is used, not taken. The file itself stops
-- being something a browser can link to, and using a piece of content in a
-- Space goes through a permission check on its ID.

-- ---------------------------------------------------------- the bucket

/*
 * Browsers label .ogg as application/ogg rather than audio/ogg, which was
 * rejecting perfectly good sound uploads. The rest are formats people
 * reasonably expect to be able to upload.
 */
update storage.buckets
   set public = false,
       allowed_mime_types = array[
         'image/png','image/jpeg','image/gif','image/webp','image/avif',
         'audio/mpeg','audio/mp3','audio/ogg','application/ogg','audio/wav',
         'audio/x-wav','audio/wave','audio/aac','audio/flac','audio/mp4',
         'video/mp4','video/webm','video/ogg',
         'font/woff2','font/woff','font/ttf','font/otf',
         'application/font-woff','application/x-font-ttf','application/vnd.ms-opentype',
         'model/gltf-binary','model/gltf+json','application/octet-stream'
       ]
 where id = 'uploads';

/*
 * A private bucket means there is no public link to hand around: the page
 * asks for a short-lived signed URL when it needs to show something, and
 * that is only granted for content that is actually listed, or for your own
 * files. This does not make a picture on screen impossible to capture, and
 * nothing here pretends otherwise. What it does is stop the file being
 * addressable, and keep use of it behind the permission check below.
 */
drop policy if exists uploads_read on storage.objects;
create policy uploads_read on storage.objects for select
  using (
    bucket_id = 'uploads'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_moderator()
      or exists (
        select 1 from public.assets a
         where a.file_path = storage.objects.name
           and a.status = 'approved'
           and a.is_public
      )
    )
  );

-- ------------------------------------------------------------- permission

/*
 * Who may use a piece of content by its ID.
 *
 * The creator always can. Anything uploaded by a Kobbleston account is
 * verified and open to everyone, which is what makes the official library
 * useful. Everything else needs the creator to say yes, and the asking and
 * the answering both live here.
 */
create table if not exists public.asset_grants (
  asset_id uuid not null references public.assets on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  state text not null default 'requested' check (state in ('requested', 'granted')),
  note text check (char_length(note) <= 300),
  requested_at timestamptz not null default now(),
  answered_at timestamptz,
  primary key (asset_id, user_id)
);

create index if not exists asset_grants_user_idx on public.asset_grants (user_id);

alter table public.asset_grants enable row level security;

create or replace function public.owns_asset(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.assets a
                  where a.id = target and a.creator_id = auth.uid());
$$;

grant execute on function public.owns_asset to authenticated;

drop policy if exists asset_grants_read on public.asset_grants;
create policy asset_grants_read on public.asset_grants for select
  using (user_id = auth.uid() or public.owns_asset(asset_id) or public.is_moderator());

-- You ask for yourself, and an ask is all you can write.
drop policy if exists asset_grants_ask on public.asset_grants;
create policy asset_grants_ask on public.asset_grants for insert
  with check (user_id = auth.uid() and state = 'requested' and not public.is_guest());

-- Withdrawing your own request, or the creator taking permission back.
drop policy if exists asset_grants_remove on public.asset_grants;
create policy asset_grants_remove on public.asset_grants for delete
  using (user_id = auth.uid() or public.owns_asset(asset_id));

/*
 * The one question everything else asks. Kept as a function so the answer is
 * the same wherever it is asked from: the item page, the editor, or a policy.
 */
create or replace function public.can_use_asset(target uuid, who uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.assets a
      join public.profiles p on p.id = a.creator_id
     where a.id = target
       and a.status = 'approved'
       and (
         a.creator_id = who
         or p.is_admin
         or exists (select 1 from public.asset_grants g
                     where g.asset_id = a.id and g.user_id = who and g.state = 'granted')
       )
  );
$$;

grant execute on function public.can_use_asset to anon, authenticated;

-- The creator answers. Saying no removes the request rather than keeping a
-- refusal on file.
create or replace function public.answer_asset_request(
  target uuid, asker uuid, accept boolean
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.owns_asset(target) and not public.is_moderator() then
    raise exception 'That is not yours to answer.';
  end if;

  if accept then
    update public.asset_grants
       set state = 'granted', answered_at = now()
     where asset_id = target and user_id = asker;
  else
    delete from public.asset_grants where asset_id = target and user_id = asker;
  end if;
end;
$$;

grant execute on function public.answer_asset_request to authenticated;

-- Requests waiting on a creator, across everything they have uploaded.
drop function if exists public.asset_requests_for_me();
create function public.asset_requests_for_me()
returns table (
  asset_id uuid,
  asset_name text,
  kind public.asset_kind,
  content_id bigint,
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  note text,
  requested_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.kind, a.content_id,
         p.id, p.username, p.display_name, p.avatar_url,
         g.note, g.requested_at
    from public.asset_grants g
    join public.assets a on a.id = g.asset_id
    join public.profiles p on p.id = g.user_id
   where a.creator_id = auth.uid() and g.state = 'requested'
   order by g.requested_at;
$$;

grant execute on function public.asset_requests_for_me to authenticated;

-- Everything you are allowed to use, which is what an editor would offer.
drop function if exists public.assets_i_can_use();
create function public.assets_i_can_use()
returns table (
  id uuid,
  kind public.asset_kind,
  name text,
  file_path text,
  thumbnail_path text,
  content_id bigint,
  creator_username text,
  source text
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.file_path, a.thumbnail_path, a.content_id, p.username,
         case when a.creator_id = auth.uid() then 'yours'
              when p.is_admin then 'verified'
              else 'granted' end
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.status = 'approved'
     and (
       a.creator_id = auth.uid()
       or p.is_admin
       or exists (select 1 from public.asset_grants g
                   where g.asset_id = a.id and g.user_id = auth.uid() and g.state = 'granted')
     )
   order by a.created_at desc;
$$;

grant execute on function public.assets_i_can_use to authenticated;

-- Downloads are no longer a thing that happens, so the event kind goes with
-- it. Old rows stay: they are history, not a claim about today.
create or replace function public.record_asset_event(target uuid, event_kind text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if event_kind not in ('view', 'use') then
    raise exception 'Unknown event.';
  end if;
  if not exists (select 1 from public.assets a
                  where a.id = target and a.status = 'approved' and a.is_public) then
    return;
  end if;

  insert into public.asset_events (asset_id, kind) values (target, event_kind);

  if event_kind = 'use' then
    perform set_config('kobbleston.counting', 'on', true);
    update public.assets set download_count = download_count + 1 where id = target;
    perform set_config('kobbleston.counting', 'off', true);
  end if;
end;
$$;

alter table public.asset_events drop constraint if exists asset_events_kind_check;
alter table public.asset_events add constraint asset_events_kind_check
  check (kind in ('view', 'download', 'use'));

-- The analytics follow the same rename.
drop function if exists public.asset_analytics(uuid);
create function public.asset_analytics(target uuid)
returns table (day date, views bigint, uses bigint)
language sql stable security definer set search_path = public as $$
  with allowed as (
    select 1 from public.assets a
     where a.id = target and (a.creator_id = auth.uid() or public.is_moderator())
  ),
  days as (
    select generate_series(current_date - 29, current_date, interval '1 day')::date as day
  )
  select d.day,
         count(*) filter (where e.kind = 'view') as views,
         count(*) filter (where e.kind in ('use', 'download')) as uses
    from days d
    left join public.asset_events e
      on e.asset_id = target and e.created_at::date = d.day
   where exists (select 1 from allowed)
   group by d.day
   order by d.day;
$$;

grant execute on function public.asset_analytics to authenticated;

drop function if exists public.creator_analytics(uuid);
create function public.creator_analytics(target uuid)
returns table (
  asset_id uuid,
  name text,
  kind public.asset_kind,
  content_id bigint,
  status public.moderation_status,
  is_public boolean,
  views bigint,
  uses bigint,
  pending_requests bigint,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select a.id, a.name, a.kind, a.content_id, a.status, a.is_public,
         count(*) filter (where e.kind = 'view'),
         count(*) filter (where e.kind in ('use', 'download')),
         (select count(*) from public.asset_grants g
           where g.asset_id = a.id and g.state = 'requested'),
         a.created_at
    from public.assets a
    left join public.asset_events e on e.asset_id = a.id
   where a.creator_id = target
     and (target = auth.uid() or public.is_moderator())
   group by a.id
   order by a.created_at desc;
$$;

grant execute on function public.creator_analytics to authenticated;

-- The item page carries whether the person looking at it may use the thing.
drop function if exists public.get_asset(bigint);
create function public.get_asset(target_content_id bigint)
returns table (
  id uuid,
  kind public.asset_kind,
  name text,
  description text,
  file_path text,
  thumbnail_path text,
  byte_size bigint,
  download_count integer,
  content_id bigint,
  status public.moderation_status,
  is_public boolean,
  review_note text,
  created_at timestamptz,
  updated_at timestamptz,
  creator_id uuid,
  creator_username text,
  creator_display_name text,
  creator_avatar_url text,
  creator_is_admin boolean,
  i_can_use boolean,
  i_asked boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.kind, a.name, a.description, a.file_path, a.thumbnail_path,
         a.byte_size, a.download_count, a.content_id, a.status, a.is_public,
         case when a.creator_id = auth.uid() or public.is_moderator()
              then a.review_note end,
         a.created_at, a.updated_at,
         p.id, p.username, p.display_name, p.avatar_url, p.is_admin,
         public.can_use_asset(a.id),
         exists (select 1 from public.asset_grants g
                  where g.asset_id = a.id and g.user_id = auth.uid())
    from public.assets a
    join public.profiles p on p.id = a.creator_id
   where a.content_id = target_content_id
     and (
       (a.status = 'approved' and a.is_public and not p.is_suspended)
       or a.creator_id = auth.uid()
       or public.is_moderator()
     );
$$;

grant execute on function public.get_asset to anon, authenticated;

-- The extension check should accept the same formats the bucket now does,
-- otherwise a file uploads and is then turned down for its name.
create or replace function public.expected_extensions(kind public.asset_kind)
returns text[] language sql immutable as $$
  select case kind
    when 'image' then array['png','jpg','jpeg','gif','webp','avif']
    when 'audio' then array['mp3','ogg','oga','wav','flac','aac','m4a']
    when 'video' then array['mp4','webm','ogv']
    when 'font'  then array['woff2','woff','ttf','otf']
    when 'model' then array['glb','gltf']
  end;
$$;

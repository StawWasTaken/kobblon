begin;

-- What somebody's avatar is, and what can be put on it.
--
-- Staw's brief, written down here because the shape of it is the whole
-- design: a shirt and trousers are pictures drawn into a template; a tdecal
-- is any picture, stuck straight onto the torso; an accessory and hair are
-- models with a texture; a face is a picture on the head. Who may make each
-- one, what making it costs, and the least it may be sold for all differ, so
-- those are data rather than six near-identical code paths.
--
-- Three tables and a colour.
--
--   * `avatar_items` - the things. Separate from `assets`, which is the
--     Creator Marketplace: an asset is a file somebody uses in a World, an
--     avatar item is a thing somebody wears. They have different rules about
--     who may make them, different prices, and different moderation; one
--     table pretending to be both would be a column saying which it is and
--     every query remembering to ask.
--   * `avatar_owned` - who has what. Buying is not wearing.
--   * `avatar_worn` - what each person has on, one thing per slot.
--
-- And `profiles.body`, the colour of each part, which is not a thing you own
-- and so is not an item.
--
-- The RPCs that make, buy and wear these are 0113. This file is the shape
-- and the policies, so that the thing being granted rights over exists
-- before anything is granted rights over it.

-- ---------------------------------------------------------------- the body

alter table public.profiles
  add column if not exists body jsonb;

comment on column public.profiles.body is
  'The colour of each body part, as {"Head":"#f2d08a", ...}. Null means the '
  'colours the engine starts with. Not an owned thing: a colour is not an '
  'item, it is a setting.';

-- ------------------------------------------------------------- the things

create table if not exists public.avatar_items (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  content_id bigint not null default nextval('public.content_id_seq'),

  /*
   * What kind of thing it is. Text with a check rather than an enum: adding
   * a kind to an enum cannot be used in the same migration that adds it,
   * which has already cost this schema a failed deploy, and a kind is
   * exactly the sort of thing somebody adds later.
   */
  kind text not null check (kind in ('shirt', 'trousers', 'tdecal', 'accessory', 'hair', 'face')),

  /*
   * Where it goes, for the kinds that can go in more than one place. An
   * accessory is a hat or a front or a back or a neck thing; a shirt is only
   * ever a shirt, and says so by having its kind as its slot.
   */
  slot text not null check (slot in (
    'shirt', 'trousers', 'tdecal', 'face', 'hair',
    'hat', 'front', 'back', 'neck', 'waist', 'leftHand', 'rightHand'
  )),

  name text not null check (length(btrim(name)) between 1 and 60),
  description text check (length(description) <= 400),
  price integer not null default 0 check (price >= 0 and price <= 100000),

  /** A picture, for the kinds that are a picture: shirt, trousers, tdecal, face. */
  image_path text,
  /** A model and what it wears, for the kinds that are a model. */
  mesh_id uuid references public.assets(id) on delete set null,
  texture_id uuid references public.assets(id) on delete set null,

  status public.moderation_status not null default 'pending',
  review_note text,
  reviewed_at timestamptz,
  is_public boolean not null default false,
  is_removed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /*
   * A picture kind needs a picture and a model kind needs a model. Stated
   * here rather than in whatever creates one, because a row that is neither
   * is a thing the renderer will be handed one day and cannot draw.
   */
  constraint avatar_item_has_its_thing check (
    case when kind in ('shirt', 'trousers', 'tdecal', 'face')
         then image_path is not null
         else mesh_id is not null end
  )
);

create unique index if not exists avatar_items_content_idx
  on public.avatar_items (content_id);
create index if not exists avatar_items_creator_idx
  on public.avatar_items (creator_id, created_at desc);
create index if not exists avatar_items_shelf_idx
  on public.avatar_items (kind, created_at desc)
  where is_public and not is_removed and status = 'approved';

-- ------------------------------------------------------------- who has what

create table if not exists public.avatar_owned (
  item_id uuid not null references public.avatar_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  got_at timestamptz not null default now(),
  primary key (item_id, user_id)
);

create index if not exists avatar_owned_person_idx
  on public.avatar_owned (user_id, got_at desc);

-- ---------------------------------------------------------- what is worn

create table if not exists public.avatar_worn (
  user_id uuid not null references public.profiles(id) on delete cascade,
  /*
   * One thing per slot. Two hats is a bug rather than a style, and the
   * engine's sockets hold one thing each - so the database says the same,
   * and nothing downstream has to decide which of two hats wins.
   */
  slot text not null check (slot in (
    'shirt', 'trousers', 'tdecal', 'face', 'hair',
    'hat', 'front', 'back', 'neck', 'waist', 'leftHand', 'rightHand'
  )),
  item_id uuid not null references public.avatar_items(id) on delete cascade,
  primary key (user_id, slot)
);

create index if not exists avatar_worn_item_idx on public.avatar_worn (item_id);

-- ------------------------------------------------------------ the rules

/**
 * What each kind costs to make, the least it may be sold for, and who may
 * make one.
 *
 * A function rather than numbers scattered through the RPCs, because every
 * one of these is a number Staw will change - and because the page that
 * offers somebody an upload has to say the price before they commit to it,
 * which means the website needs to read the same answer the charge is made
 * from.
 */
create or replace function public.avatar_rules()
returns table(
  kind text, upload_cost integer, least_price integer,
  needs_verified boolean, kobblon_only boolean
)
language sql immutable
set search_path = public, extensions as $$
  select * from (values
    ('shirt',     10,  5, false, false),
    ('trousers',  10,  5, false, false),
    -- Any picture, straight onto the torso. Cheap to make and allowed to be
    -- free, because it is the one anybody can try.
    ('tdecal',     2,  0, false, false),
    -- A model with a texture, so a much bigger thing to get wrong, and only
    -- for accounts that have been verified.
    ('accessory', 40, 30, true,  false),
    ('hair',      40, 30, true,  false),
    -- Kobblon's own.
    ('face',       0,  0, false, true)
  ) as rules(kind, upload_cost, least_price, needs_verified, kobblon_only);
$$;

grant execute on function public.avatar_rules to anon, authenticated;

-- ------------------------------------------------------------- policies

alter table public.avatar_items enable row level security;
alter table public.avatar_owned enable row level security;
alter table public.avatar_worn  enable row level security;

/*
 * Reading an item: anybody may see one that is approved, listed and not
 * taken down. Its maker sees their own whatever state it is in, because
 * otherwise uploading something and waiting for screening looks like the
 * upload failed. A moderator sees everything, which is the job.
 */
drop policy if exists avatar_items_read on public.avatar_items;
create policy avatar_items_read on public.avatar_items for select
  using (
    (status = 'approved' and is_public and not is_removed)
    or creator_id = auth.uid()
    or public.is_moderator()
  );

/*
 * Writing is through the functions in 0113 and nowhere else. No insert,
 * update or delete policy exists here on purpose: making an item charges
 * Brix, checks who you are and screens what you wrote, and a table anybody
 * could insert into directly is every one of those checks made optional.
 */

drop policy if exists avatar_owned_read on public.avatar_owned;
create policy avatar_owned_read on public.avatar_owned for select
  using (user_id = auth.uid() or public.is_moderator());

/*
 * What somebody is wearing is public, the way a person standing in a World
 * is public. Reading it is how everybody else draws them.
 */
drop policy if exists avatar_worn_read on public.avatar_worn;
create policy avatar_worn_read on public.avatar_worn for select
  using (true);

grant select on public.avatar_items to anon, authenticated;
grant select on public.avatar_owned to authenticated;
grant select on public.avatar_worn  to anon, authenticated;

commit;

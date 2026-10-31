begin;

/*
 * Stickers, and the custom emoji they share a road with.
 *
 * Staw has drawn nine of Plunk and wants them sendable in three places:
 * the World chat in the Launcher, the friends chat here, and a community
 * wall. His words: "i wanna add these 'plunk' stickers so that we have
 * gifs, emojis and stickers, for context plunk is kind of our mascot".
 *
 * The decision the applications' session asked for, and it is the right
 * one: **a sticker travels as a name, never as an address.** The Launcher
 * resolves its own pictures through `app://kobblon/...`, a protocol only
 * that application has registered, and the website draws the same picture
 * from an ordinary path. One picture, two true addresses. Put an address
 * in a message and it is an address that was only ever true in the place
 * it was typed: a sticker sent from a World would land on a wall in a
 * browser as nothing at all.
 *
 * So the message carries `:plunk-smug:` and whoever draws it looks the
 * name up. It survives all three places, which is Staw's actual
 * requirement, and it costs `screen_say` nothing - a name is not a link,
 * so a sticker needs no entry in `allowed_link_hosts` and cannot be the
 * hole a pasted address would be.
 *
 * One namespace, not two. They asked whether stickers should sit beside
 * the custom emoji or in a namespace of their own; one table, because a
 * name must mean exactly one thing. Two namespaces is two lookups and the
 * day somebody registers `:plunk-smug:` in both there is no answer to
 * which picture a message meant. What differs between a sticker and a
 * custom emoji is how it is *drawn*, so that is a column: `draws`.
 */

create table if not exists public.pictures_by_name (
  /*
   * The token, without its colons. Lowercase, and the hyphen is the only
   * separator: `plunk-smug`. The set is part of the name rather than a
   * namespace above it, so one `insert` adds a picture and nothing has to
   * be told that a new set exists.
   */
  name text primary key
    check (name = lower(name) and name ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(name) between 2 and 48),

  /** Which sheet it came off. `plunk` here; Staw's K is `kobblon`. */
  pack text not null check (pack ~ '^[a-z0-9-]+$'),

  /** For whoever cannot see it, and the word the picker searches on. */
  label text not null check (length(btrim(label)) between 1 and 60),

  /*
   * Where the picture is, as a path from the site root and never a whole
   * address. The Launcher is welcome to read this column and resolve it
   * its own way - `app://kobblon` plus this - which is the point of it
   * being a path: an application that cannot reach `https://kobblon.com`
   * is not stuck with a column that assumed it could.
   */
  picture text not null check (picture ~ '^/[A-Za-z0-9._/-]+$'),

  /*
   * The small one, for a picker that opens two dozen at once. Their round
   * 57 asked for this and they are right about the arithmetic: nine 512px
   * PNGs is 1.4MB to show a grid of nine. The same nine at 256 WebP is
   * 72KB. The big one stays as the source and is what a sticker is drawn
   * from in a message.
   */
  small text check (small ~ '^/[A-Za-z0-9._/-]+$'),

  /*
   * How it is drawn, which is the whole difference between the two kinds.
   *
   * `alone`  - a sticker. The whole message, drawn large, the way a GIF
   *            already is. It is only a picture when it is the entire
   *            message; with words around it the characters stay the
   *            characters somebody typed.
   * `inline` - a custom emoji. A character inside a sentence.
   */
  draws text not null default 'alone' check (draws in ('alone', 'inline')),

  /** The order Staw drew them in, so a picker is not alphabetical by accident. */
  sort int not null default 0,

  /*
   * Retired rather than deleted. A message sent last year still carries
   * the name, and deleting the row would turn it into the literal text
   * `:plunk-smug:` in somebody's conversation. Retired means "not in the
   * picker"; it is still drawn where it was sent.
   */
  retired boolean not null default false,

  added_at timestamptz not null default now()
);

/*
 * Grants in the same file as the table. This project's fourth trap, which
 * has cost it a fortnight twice: a policy decides which rows a role may
 * see and a grant decides whether the role may touch the table at all,
 * and a new table has no grants. Read by anybody, including a signed-out
 * visitor reading a community wall.
 */
grant select on public.pictures_by_name to anon, authenticated;

alter table public.pictures_by_name enable row level security;

drop policy if exists pictures_by_name_read on public.pictures_by_name;
create policy pictures_by_name_read on public.pictures_by_name
  for select using (true);

/* Nothing writes this from the client. Adding a picture is a migration or
   a staff hand, both of which are the service role. */

create index if not exists pictures_by_name_pack on public.pictures_by_name (pack, sort);

comment on table public.pictures_by_name is
  'Stickers and custom emoji, by the name a message carries. One row per token.';

/* --------------------------------------------------- Plunk, set two of nine */

/*
 * Staw drew these as `Set02_01_Excited` and so on. The number was the
 * order on his sheet and the word was the feeling, and a token with a
 * number in it would mean somebody has to remember that Plunk's smug face
 * is the fourth one - so the number became `sort` and the word became the
 * name. The files were renamed to match, which he allowed: he can
 * "rename the images and/or move them too".
 *
 * They are `Set02`. If there is a `Set01` it has not been handed over.
 * Nothing here is numbered by set, deliberately: `plunk-smug` is the name
 * of a picture of Plunk being smug, whichever sheet it arrived on, and a
 * set number in the token would be a fact about a file rather than about
 * the sticker.
 */
insert into public.pictures_by_name (name, pack, label, picture, small, draws, sort) values
  ('plunk-excited',     'plunk', 'Plunk, excited',     '/stickers/plunk/excited.png',     '/stickers/plunk/excited.webp',     'alone', 1),
  ('plunk-embarrassed', 'plunk', 'Plunk, embarrassed', '/stickers/plunk/embarrassed.png', '/stickers/plunk/embarrassed.webp', 'alone', 2),
  ('plunk-worried',     'plunk', 'Plunk, worried',     '/stickers/plunk/worried.png',     '/stickers/plunk/worried.webp',     'alone', 3),
  ('plunk-smug',        'plunk', 'Plunk, smug',        '/stickers/plunk/smug.png',        '/stickers/plunk/smug.webp',        'alone', 4),
  ('plunk-dizzy',       'plunk', 'Plunk, dizzy',       '/stickers/plunk/dizzy.png',       '/stickers/plunk/dizzy.webp',       'alone', 5),
  ('plunk-relieved',    'plunk', 'Plunk, relieved',    '/stickers/plunk/relieved.png',    '/stickers/plunk/relieved.webp',    'alone', 6),
  ('plunk-pleading',    'plunk', 'Plunk, pleading',    '/stickers/plunk/pleading.png',    '/stickers/plunk/pleading.webp',    'alone', 7),
  ('plunk-unimpressed', 'plunk', 'Plunk, unimpressed', '/stickers/plunk/unimpressed.png', '/stickers/plunk/unimpressed.webp', 'alone', 8),
  ('plunk-determined',  'plunk', 'Plunk, determined',  '/stickers/plunk/determined.png',  '/stickers/plunk/determined.webp',  'alone', 9)
on conflict (name) do update set
  pack = excluded.pack,
  label = excluded.label,
  picture = excluded.picture,
  small = excluded.small,
  draws = excluded.draws,
  sort = excluded.sort;

commit;

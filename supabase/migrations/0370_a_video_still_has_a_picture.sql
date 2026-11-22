begin;

/*
 * One rule for a video, instead of two.
 *
 * 0368 made the first of a World's pictures its thumbnail and said a video
 * one plays muted wherever the World is drawn. In practice that is three
 * behaviours, not one: a card that was written to draw an <img> shows a
 * broken picture, a card that does play it shows navy for as long as the
 * first frames take to arrive, and a shelf of them downloads a dozen
 * videos to show a dozen thumbnails.
 *
 * So: **a video thumbnail is a still frame everywhere, and the video
 * itself plays only on the World's own page, in Kobblon's player.** One
 * behaviour, every page, nothing to get wrong.
 *
 * The frame is drawn in the browser when the video is added - a quarter of
 * the way in, which is what `previewOf` already does for the Creator Hub's
 * cards, because the first frame of a video is so often black. It is kept
 * beside the video as `poster_path`, and `worlds.cover_url` points at the
 * frame rather than the film.
 *
 * `cover_is_video` stays, and now means "the thumbnail is a still of a
 * video" - which is what tells a card to draw a play mark on it.
 */

alter table public.world_media
  add column if not exists poster_path text;

do $$ begin
  alter table public.world_media
    add constraint world_media_poster_is_a_path check (
      poster_path is null
      or (
        char_length(poster_path) between 3 and 400
        and poster_path !~ '[[:space:]]'
        and poster_path !~ '\.\.'
        -- A path inside the bucket, never an address. `path` next to it has
        -- the looser check it was born with; an address there only produces
        -- a link that does not load, because every reader prefixes it with
        -- this project's storage host, but a new column may as well say
        -- what it means.
        and poster_path !~ '://'
      )
    );
exception when duplicate_object then null;
end $$;

/*
 * The first picture a World shows is its thumbnail, and when that one is a
 * video the thumbnail is the frame drawn from it. A video with no frame -
 * one added before this, or one whose frame would not draw - still points
 * at the film, because a World with a picture nobody can see is worse than
 * a card that has to cope with a video.
 */
create or replace function public.world_cover_follows_media()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  touched uuid := coalesce(new.world_id, old.world_id);
  lead public.world_media;
begin
  select * into lead
    from public.world_media
   where world_id = touched
   order by position, created_at
   limit 1;

  update public.worlds
     set cover_url = case
                       when lead.id is null then null
                       else public.storage_base() || '/worlds/'
                            || coalesce(lead.poster_path, lead.path)
                     end,
         cover_is_video = coalesce(lead.kind = 'video', false),
         updated_at = now()
   where id = touched;

  return null;
end $$;

-- And the Worlds whose thumbnail is a film today.
update public.worlds w
   set cover_url = public.storage_base() || '/worlds/' || coalesce(m.poster_path, m.path),
       cover_is_video = (m.kind = 'video')
  from (
    select distinct on (world_id) world_id, path, poster_path, kind
      from public.world_media
     order by world_id, position, created_at
  ) m
 where m.world_id = w.id;

commit;

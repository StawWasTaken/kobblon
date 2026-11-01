begin;

/*
 * A line typed in a World, handed over to be read.
 *
 * The other session has asked for this four rounds running, and it is the
 * whole of why the staff console's machine page shows nothing from the
 * Launcher: a World's chat has no table on this database, so nothing
 * queues it, so Kobby never sees a word of it.
 *
 * `heard_in_voice` is the shape, and this is deliberately a copy of it
 * rather than a cleverer version. What arrives by hand needs exactly two
 * things - a narrow door and a rate limit - and the rest of the path
 * already exists: `ai_work` hands every `chat_to_read` row to the model as
 * a message whatever its kind, `judge_chat_line` weighs the rule against
 * the person's standing, and the ladder decides what happens. Nothing new
 * is needed for a World line because a World line is a line somebody said.
 *
 * The one difference from voice, and it is the reason the kind exists at
 * all rather than being filed as `space_message`:
 *
 *   * **It is typed, so it costs chat and not voice.** `judge_chat_line`
 *     turns `quieted` into `quieted_voice` only for `voice`, which is
 *     right: somebody who typed something does not lose their microphone
 *     for it. Filing a World line as `voice` would have done exactly that.
 *   * **And the model is not told it was transcribed.** The worker adds
 *     "said out loud and transcribed, so the wording may be imperfect"
 *     for `voice` alone. A typed line read with that excuse on it is a
 *     line the model forgives spelling for that the person actually
 *     chose.
 *
 * What this is not: a chat log. Nothing here keeps a World's conversation.
 * A row is a line waiting to be read, it is read, and `judge_chat_line`
 * marks it read; what survives is a violation if there was one. A table of
 * everything anybody has ever said in a World is a different thing with
 * different promises around it, and it is not being built by accident
 * through a moderation door.
 */

-- ------------------------------------------------------------ a sixth kind

/*
 * A check constraint and not an enum, which is why this is safe in one
 * transaction: 0276 widened it the same way, and an enum value cannot be
 * added and used in the transaction that added it.
 */
alter table public.chat_to_read drop constraint if exists chat_to_read_kind_check;
alter table public.chat_to_read add constraint chat_to_read_kind_check
  check (kind in ('message', 'space_message', 'community_post', 'voice',
                  'forum_topic', 'forum_post', 'said_in_world'));

/**
 * A line somebody typed in a World.
 *
 * `where_at` is whatever the Launcher calls the place - a World id, a
 * server id, a room - and it is kept only so a moderator reading the
 * decision afterwards can tell where it happened. Nothing is looked up
 * from it, and nothing is trusted about it: it is a label on evidence,
 * not a permission.
 *
 * Censored on the way in by the same patterns the website's chat goes
 * through, with the original kept beside it in `said` - the lesson of
 * 0265, which found the queue had been storing the masked copy and
 * handing the model bullets. `was_masked` is still passed on, because a
 * line the patterns objected to is a different thing to read than one
 * they did not.
 *
 * Sixty lines a minute per person, the same ceiling voice has. Nobody
 * types that much; a client that breaks and floods is a bill, and the
 * person it is flooding on behalf of has done nothing wrong.
 */
create or replace function public.said_in_world(said text, where_at text default null)
returns bigint
language plpgsql security definer
set search_path = public, extensions as $$
declare
  me uuid := auth.uid();
  clean text;
  made bigint;
begin
  if me is null then raise exception 'Sign in first.'; end if;

  said := btrim(coalesce(said, ''));
  if said = '' then return null; end if;
  if char_length(said) > 2000 then
    said := left(said, 2000);
  end if;

  if (select count(*) from public.chat_to_read c
       where c.who = me and c.kind = 'said_in_world'
         and c.created_at > now() - interval '1 minute') >= 60 then
    raise exception 'That is more than anybody types in a minute.';
  end if;

  clean := public.censor_text(said, 'chat');

  insert into public.chat_to_read (kind, ref, who, body, said, was_masked)
  values ('said_in_world', left(coalesce(where_at, 'world'), 200), me, clean, said,
          clean <> said)
  returning id into made;

  return made;
end $$;

/*
 * Granted to `authenticated` and to nobody else, which is the same door
 * `heard_in_voice` has. It writes a row about the caller and only about
 * the caller - `who` is `auth.uid()` and is not an argument - so the worst
 * a modified client can do with it is report itself.
 */
revoke all on function public.said_in_world(text, text) from public;
grant execute on function public.said_in_world(text, text) to authenticated;

commit;

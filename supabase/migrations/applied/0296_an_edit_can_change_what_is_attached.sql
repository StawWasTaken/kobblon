/*
 * Editing a post can change its attachments.
 *
 * Staw: "we cant actually edit posts (especially attached content)". He is
 * right twice over. `forum_edit` took a body and a title and nothing else,
 * so a picture attached to a topic was attached for ever: the only way to
 * take one off was to delete the topic and write it again, which loses the
 * replies under it.
 *
 * `in_images` is null by default and null means *leave them alone*, which
 * is what every caller written before today does. An array replaces the
 * lot, and an empty array takes them all off. There is no "add one" -
 * the composer already holds the whole set while it is open, and a
 * per-attachment door is a second way to do the same thing that can
 * disagree with the first.
 *
 * The four-attachment ceiling is said here as well as in
 * `forum_topic_create`, for the reason the composer says it a third time:
 * a rule that only exists in a browser is not a rule, and an edit that
 * can carry six is a way round the create that refuses them.
 *
 * It stays author-only. 0289 said why, and nothing here changes it: staff
 * do not rewrite somebody's words, they take the post down.
 *
 * Dropped before it is created rather than replaced: the new parameter
 * makes a different signature, so `create or replace` would leave the old
 * four-argument function sitting beside it and every existing call - which
 * is every call, since PostgREST passes these by name - would fail as "not
 * unique" rather than resolving to either.
 */

begin;

drop function if exists public.forum_edit(text, bigint, text, text);

create or replace function public.forum_edit(
  in_what text, in_id bigint, in_body text,
  in_title text default null, in_images text[] default null
)
returns void language plpgsql security definer
set search_path = public, extensions as $$
begin
  perform public.forum_may_write();

  if in_images is not null and coalesce(array_length(in_images, 1), 0) > 4 then
    raise exception 'Four attachments at most.';
  end if;

  if in_what = 'topic' then
    update public.forum_topics
       set body = in_body,
           title = coalesce(in_title, title),
           images = coalesce(in_images, images),
           edited_at = now()
     where id = in_id and author_id = auth.uid() and not is_removed;
    if not found then raise exception 'That is not yours to edit.'; end if;
  elsif in_what = 'post' then
    update public.forum_posts
       set body = in_body,
           images = coalesce(in_images, images),
           edited_at = now()
     where id = in_id and author_id = auth.uid() and not is_removed;
    if not found then raise exception 'That is not yours to edit.'; end if;
  else
    raise exception 'You can edit a topic or a post.';
  end if;
end $$;

grant execute on function public.forum_edit to authenticated;

commit;

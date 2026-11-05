begin;

/*
 * A forum post can be reported.
 *
 * Staw: "ofc every forum post is analyzed by Kobby too and you can report
 * forum posts (admins can pin posts too)".
 *
 * Kobby already reads them - 0276 put every topic and every reply into
 * `chat_to_read`, the same queue a line of chat goes into, with the title
 * screened alongside the body. Pinning already exists too, as
 * `forum_set_flags`, admins and moderators only.
 *
 * Reporting was the one that did not: `reports.target_type` had no forum in
 * its list, so the flag on a post had nowhere to go. This adds the two
 * kinds and teaches `report_subject` to say what they are, which is what
 * the moderation console reads to show a moderator what they are looking at
 * and where to go and see it.
 *
 * The difference between the two matters: Kobby is automatic and reads
 * everything, and a report is a person saying this one. Kobby can take a
 * post down; a report puts it in front of somebody who can.
 */

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in (
    'profile', 'space', 'message', 'ad', 'asset', 'community', 'style',
    'avatar_item', 'voice', 'outfit', 'forum_topic', 'forum_post'));

/*
 * Replaced wholesale, taken from 0233 as it stands with two branches added
 * and nothing else touched - `create or replace` is the only way to change
 * a body, and retyping a chain of twelve branches from memory is how one
 * of them quietly goes missing.
 */
create or replace function public.report_subject(kind text, which text)
returns table (owner_id uuid, label text, link text, gone boolean)
language plpgsql stable security definer
set search_path = public, extensions as $$
declare id_as_uuid uuid;
begin
  begin
    id_as_uuid := which::uuid;
  exception when others then
    id_as_uuid := null;
  end;

  if kind = 'profile' then
    return query select p.id, p.username, '/u/' || p.username, false
                   from public.profiles p where p.id = id_as_uuid;
  elsif kind = 'voice' then
    return query select p.id, p.username || ', in voice', '/u/' || p.username, false
                   from public.profiles p where p.id = id_as_uuid;
  elsif kind = 'message' then
    return query select m.sender_id, 'A message', null::text, false
                   from public.messages m where m.id = (nullif(which, '')::bigint);
  elsif kind = 'space' then
    return query select s.owner_id, s.name, '/s/' || s.id::text, s.is_removed
                   from public.spaces s where s.id = id_as_uuid;
  elsif kind = 'world' then
    return query select w.owner_id, w.name, '/w/' || w.id::text, w.is_removed
                   from public.worlds w where w.id = id_as_uuid;
  elsif kind = 'asset' then
    return query select a.creator_id, a.name, '/create/asset/' || a.id::text,
                        a.status::text = 'removed'
                   from public.assets a where a.id = id_as_uuid;
  elsif kind = 'community' then
    return query select c.owner_id, c.name, '/c/' || c.id::text, c.is_removed
                   from public.communities c where c.id = id_as_uuid;
  elsif kind in ('style', 'style_item') then
    return query select t.creator_id, t.name, '/style/' || t.id::text, t.is_removed
                   from public.style_items t where t.id = id_as_uuid;
  elsif kind = 'avatar_item' then
    return query select i.creator_id, i.name, '/catalog/' || i.id::text, i.is_removed
                   from public.avatar_items i where i.id = id_as_uuid;
  /*
   * The new one. The link is the outfit's own page, by the number in its
   * address rather than its uuid, so a moderator lands where a person would
   * - the same page the report was sent from.
   */
  elsif kind = 'outfit' then
    return query select o.owner_id, o.name,
                        '/catalog/outfit/OUTF-' || o.content_id::text,
                        o.is_removed
                   from public.outfits o where o.id = id_as_uuid;
  /*
   * The forum. A topic's link is its own page; a reply's is the topic it is
   * in, because there is nowhere else to send somebody - a reply is read in
   * its thread or not at all. Both report their author, so a moderator
   * acting on one acts on the person who wrote it rather than the person
   * who started the thread.
   */
  elsif kind = 'forum_topic' then
    return query select t.author_id, t.title, '/forum/t/' || t.id::text, t.is_removed
                   from public.forum_topics t where t.id = (nullif(which, '')::bigint);
  elsif kind = 'forum_post' then
    return query select r.author_id, 'A forum reply',
                        '/forum/t/' || r.topic_id::text, r.is_removed
                   from public.forum_posts r where r.id = (nullif(which, '')::bigint);
  elsif kind = 'ad' then
    return query select d.buyer_id, 'An advert', d.target_path, not d.is_active
                   from public.ads d where d.id = id_as_uuid;
  else
    return;
  end if;
end $$;

grant execute on function public.report_subject(text, text) to authenticated, service_role;

commit;

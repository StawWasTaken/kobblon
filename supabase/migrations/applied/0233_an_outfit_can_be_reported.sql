begin;

/*
 * An outfit can be reported, like everything else with a page.
 *
 * It got a page of its own in 0232, and a page with no way to report what
 * is on it is a gap rather than a decision: an outfit carries a name
 * somebody typed, and the Catalog lists it beside everything else that can
 * be reported. The report dialog is already on the page; without this, the
 * insert behind it is refused by a check constraint and the person is told
 * nothing useful.
 *
 * Two halves, and both are needed. The constraint says a report may name an
 * outfit; `report_subject` says what that report is *about* - whose it is,
 * what it is called, and where a moderator goes to look at it. Without the
 * second, a report lands in the queue as a blank row with a uuid in it,
 * which is the shape that makes a moderator close something unread.
 */

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in (
    'profile', 'space', 'message', 'ad', 'asset', 'community', 'style',
    'avatar_item', 'voice', 'outfit'));

/*
 * `report_subject` is replaced wholesale rather than patched, because
 * `create or replace` is the only way to change a function body and this
 * one is a chain of branches. The only new branch is the outfit; everything
 * else is as it was.
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
  elsif kind = 'ad' then
    return query select d.buyer_id, 'An advert', d.target_path, not d.is_active
                   from public.ads d where d.id = id_as_uuid;
  else
    return;
  end if;
end $$;

grant execute on function public.report_subject(text, text) to authenticated, service_role;

commit;

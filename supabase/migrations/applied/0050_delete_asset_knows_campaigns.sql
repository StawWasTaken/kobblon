-- Deleting an upload still looked for a name on the ad itself, which stopped
-- existing when ads moved into campaigns: the name is the campaign's now. So
-- a decal held by an ad refused to delete with "column a.name does not
-- exist", which tells nobody anything.
--
-- Same rule as before, said properly: an ad holding the decal stops the
-- delete, and the campaigns it belongs to are named. Safe to run again.

create or replace function public.delete_asset(target uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  row_asset public.assets%rowtype;
  in_ads text;
  path text;
begin
  if auth.uid() is null then raise exception 'Not signed in.'; end if;

  select * into row_asset from public.assets where id = target;
  if row_asset.id is null then raise exception 'That is not here any more.'; end if;

  if row_asset.creator_id <> auth.uid()
     and not (row_asset.community_id is not null
              and public.community_can(row_asset.community_id, 'can_manage_community'))
     and not public.is_moderator() then
    raise exception 'That is not yours to delete.';
  end if;

  select string_agg(distinct c.name, ', ')
    into in_ads
    from public.ads a
    join public.ad_campaigns c on c.id = a.campaign_id
   where a.asset_id = target;

  if in_ads is not null then
    raise exception 'An ad is using this, in %. Take the ad out of the campaign first, then this can go.', in_ads;
  end if;

  path := row_asset.file_path;
  delete from public.assets where id = target;
  return path;
end;
$$;

grant execute on function public.delete_asset to authenticated;

-- Three things that were harder than they should have been.
--
-- Deleting your own upload went straight at the table, so it failed in ways
-- nobody could read: silently when the row was somebody else's to delete, and
-- with a foreign key complaint when an ad was using the picture. It is a
-- function now, which says what is in the way.
--
-- A finished campaign can be taken off the list, which also frees whatever
-- picture it was holding on to. Anything it never spent comes back first.
--
-- And an ad can be reported by anybody who sees one, the same way a Space or
-- a person can be. Safe to run again.

-- ------------------------------------------------------------- reporting

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('profile', 'space', 'message', 'ad', 'asset', 'community'));

-- ---------------------------------------------------------- removing ads

/**
 * Taking a finished campaign off the list. Whatever it never spent comes
 * back, the same as stopping it does, and the picture it was using is free
 * again afterwards.
 */
create or replace function public.remove_ad(target uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  row_ad public.ads%rowtype;
  left_over integer := 0;
begin
  select * into row_ad from public.ads where id = target for update;
  if row_ad.id is null then raise exception 'That ad is not here.'; end if;
  if row_ad.buyer_id <> auth.uid() and not public.is_moderator() then
    raise exception 'That is not your ad.';
  end if;

  if row_ad.is_running and (row_ad.ends_at is null or row_ad.ends_at > now())
     and row_ad.spent < row_ad.budget then
    raise exception 'That ad is still running. Stop it first.';
  end if;

  left_over := greatest(0, row_ad.budget - row_ad.spent);
  if left_over > 0 then
    perform public.move_pixels(row_ad.buyer_id, left_over, 'ad_refund',
                               'Ad removed: ' || row_ad.name);
  end if;

  delete from public.ads where id = target;
  return left_over;
end;
$$;

grant execute on function public.remove_ad to authenticated;

-- ------------------------------------------------------ deleting uploads

/**
 * Deleting an upload, with a reason when it cannot go.
 *
 * Yours to delete means you made it, or it belongs to a community whose
 * settings you can change, or you are a moderator. An ad holding the picture
 * stops the delete rather than the delete quietly failing, because the ad
 * would otherwise be left pointing at nothing.
 *
 * Returns the stored file so the caller can take that away too.
 */
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

  select string_agg(a.name, ', ' order by a.created_at)
    into in_ads
    from public.ads a
   where a.asset_id = target;

  if in_ads is not null then
    raise exception 'An ad is using this: %. Remove the ad first, then this can go.', in_ads;
  end if;

  path := row_asset.file_path;
  delete from public.assets where id = target;
  return path;
end;
$$;

grant execute on function public.delete_asset to authenticated;

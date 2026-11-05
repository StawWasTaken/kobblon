-- An ad nobody else could see.
--
-- A decal is readable by other people only when it is listed in Create.
-- Anybody sensible keeps their ad artwork unlisted, because it is an advert
-- rather than something for other people to build with, and the effect was
-- that the buyer was the only person whose browser could load the picture.
-- Everybody else was served an ad slot that stayed empty.
--
-- So a decal is readable while an ad in a live campaign is using it, listed
-- or not. Nothing else about it opens up: it is not in the Marketplace, it
-- cannot be taken into anybody's inventory, and the moment the campaign is
-- finished or the ad is taken out it goes back to being private.
--
-- Safe to run again.

/**
 * Whether a stored file is the artwork of an ad that is being shown.
 *
 * It answers on its own authority, because the ads table only lets people see
 * their own campaigns, and a policy that asked the question as the person
 * looking would always be told no.
 */
create or replace function public.decal_in_live_ad(path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.assets a
      join public.ads ad on ad.asset_id = a.id
      join public.ad_campaigns c on c.id = ad.campaign_id
     where a.file_path = path
       and a.status = 'approved'
       and ad.is_active
       and c.is_running
       and c.spent < c.budget - c.refunded
       and (c.ends_at is null or c.ends_at > now())
  );
$$;

grant execute on function public.decal_in_live_ad to anon, authenticated;

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
      -- The artwork of an ad that is actually being shown.
      or public.decal_in_live_ad(storage.objects.name)
    )
  );

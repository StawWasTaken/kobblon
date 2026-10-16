begin;

/*
 * The Waisted Torso: the first body part, made by the house.
 *
 * Staw: "i want you to make, as the kobblon account, a girl torso (like
 * roblox but slightly more original) (make the description + name too for
 * this and sell it for 95 brix)", and on the shape itself: "basically the
 * woman torso is normal blocky torso like the regular torso but in the
 * middle on each side it gets tight, like a waist".
 *
 * Here rather than in Create, and the reason is worth writing down: this is
 * a row the platform is supposed to have, like the free face and the
 * starting kit, and a row somebody has to remember to click a button for is
 * a row that is missing from the next deployment. 0247 added the kind; this
 * is the one item of it.
 *
 * Named for what it is rather than for who it is for. "Woman Torso" is the
 * one on the other platform and describes the buyer; this describes the
 * shape, which is also the honest thing to put on a Catalog page - anybody
 * may wear it.
 *
 * Approved and on sale on the way in. Screening exists to look at what
 * somebody uploaded, and nothing was uploaded: the geometry is the
 * engine's, already in the build, and there is no file and no texture for
 * anybody to have put anything in.
 *
 * `on conflict do nothing` on the shape, so applying this twice leaves one.
 */
insert into public.avatar_items (
  creator_id, kind, slot, name, description, price, shape, status, is_public
)
select
  public.kobbleston_account(),
  'bodypart', 'torso',
  'Waisted Torso',
  'The ordinary torso, taken in at the sides from halfway up so it has a '
  || 'waist. The same width at the shoulders and at the hips as the plain '
  || 'one, and the same depth front to back, so every shirt and every pair '
  || 'of trousers sits on it exactly as it does on the body you started '
  || 'with. Kobblon''s own.',
  95,
  'torso-girl',
  'approved', true
where public.kobbleston_account() is not null
  and not exists (
    select 1 from public.avatar_items
     where shape = 'torso-girl' and not is_removed
  );

/*
 * And the house owns it, like everything else it makes. `create_avatar_item`
 * does this for whoever presses the button and nobody pressed one, so it is
 * done here - otherwise the one account that cannot buy it is the account
 * that made it.
 */
insert into public.avatar_owned (item_id, user_id)
select i.id, i.creator_id
  from public.avatar_items i
 where i.shape = 'torso-girl' and not i.is_removed
on conflict do nothing;

commit;

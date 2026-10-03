/*
 * One thing from the Catalog, on its own page.
 *
 * The Catalog answers "what is for sale"; this answers "what is this". The
 * difference matters for one reason above the rest: this is the only place
 * where somebody can look at a thing properly before spending Brix on it -
 * on a body, from any angle, rather than as a square on a shelf.
 *
 * Flat first and three-dimensional on a press, everywhere, which is Staw's
 * rule and the right one: a picture is instant and a rig is a model, a
 * texture and a WebGL context. The difference between the kinds is what the
 * two views mean. Clothes are on a body in both, because a shirt laid flat
 * is its template. A face and an accessory are themselves flat - a face
 * *is* its picture - and go onto a body only when somebody asks for 3D.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faCube, faImage, faClock, faStore, faUser,
  faBasketShopping, faCheck, faTrash, faCircleCheck, faEllipsis, faFlag,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BackLink } from '@/components/ui/BackLink'
import { Menu } from '@/components/ui/Menu'
import { Confirm } from '@/components/ui/Confirm'
import { ReportDialog } from '@/components/social/ReportDialog'
import { formatCount } from '@/lib/format'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { BuyButton } from '@/components/money/BuyButton'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { NameMarks } from '@/components/brand/Verified'
import { CurrencyMark } from '@/components/brand/Currency'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  avatarItemPage, buyAvatarItem, wearAvatarItem, cardFor, catalogUrl, assetUrl,
  removeAvatarItem, avatarShelf, avatarOf,
  mannequinFace, favouriteAvatarItem,
} from '@/lib/api'
import { avatarTag, avatarNumber } from '@/lib/kinds'
import { MANNEQUIN_BODY } from '@/lib/mannequin'
import { useBasket, putInBasket, takeOutOfBasket } from '@/hooks/useBasket'
import type { AvatarItem } from '@/types/db'
import { cn } from '@/lib/cn'

/** Where a thing is worn, said as somebody would say it. */
const WHERE_WORDS: Record<string, string> = {
  shirt: 'Over the torso and arms',
  trousers: 'Over the torso and legs',
  tdecal: 'On the front of the torso',
  face: 'On the face',
  hair: 'On the head',
  hat: 'On the head',
  front: 'On the chest',
  back: 'On the back',
  neck: 'Round the neck',
  waist: 'Round the waist',
  leftHand: 'In the left hand',
  rightHand: 'In the right hand',
}

const KIND_WORDS: Record<string, string> = {
  shirt: 'Shirt', trousers: 'Trousers', tdecal: 'T-decal',
  accessory: 'Accessory', hair: 'Hair', face: 'Face',
}

export default function CatalogItem() {
  const { tag = '' } = useParams()
  const { profile } = useAuth()
  const say = useToast()

  const wanted = avatarNumber(tag)
  const thing = useAsync(
    async () => (wanted ? avatarItemPage(wanted) : null),
    [wanted],
  )
  const item = thing.data ?? null

  useTitle(item ? item.name : 'Catalog')

  const [busy, setBusy] = useState(false)
  const [owned, setOwned] = useState(false)
  const basket = useBasket()
  /*
   * Taking something down, for Kobblon. Offered on what the page can see and
   * refused by the server for anybody else, as always. Two presses, because
   * it spends Kobblon's Brix and cannot be undone - everybody who bought it
   * is paid 40% back the moment it goes.
   */
  const canRemove = !!profile?.is_admin || !!profile?.is_moderator
  const [sureRemove, setSureRemove] = useState(false)
  const [reporting, setReporting] = useState(false)
  /*
   * Buying asks first. It spends Brix and cannot be undone, and the one
   * thing worse than a slow purchase is a fast one somebody did not mean -
   * a card with the price in it is half a second against that.
   */
  const [confirming, setConfirming] = useState(false)
  /*
   * The star, held here so a press shows immediately and the count comes
   * from the server's answer rather than from this page adding one to a
   * number it was given a minute ago.
   */
  const [stars, setStars] = useState(0)
  const [starred, setStarred] = useState(false)
  useEffect(() => {
    setStars(item?.stars ?? 0)
    setStarred(!!item?.starred)
  }, [item?.id, item?.stars, item?.starred])

  const star = async () => {
    if (!item || !profile) return
    const want = !starred
    try {
      setStarred(want)
      setStars(await favouriteAvatarItem(item.id, want))
    } catch (error) {
      setStarred(!want)
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    }
  }
  const put = !!item && basket.some((one) => one.id === item.id)
  useEffect(() => { setOwned(!!item?.owned) }, [item?.id, item?.owned])

  const closed = !!item?.sells_until
    && new Date(item.sells_until).getTime() <= Date.now()

  const take = async () => {
    if (!item || !profile) return
    setBusy(true)
    try {
      if (!owned) {
        await buyAvatarItem(item.id)
        setOwned(true)
        say(item.price > 0 ? `Bought for ${item.price} Brix.` : 'It is yours.', 'success')
      }
      await wearAvatarItem(item.id)
      say('On.', 'success')
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not work.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (thing.loading) {
    return (
      <Page className="space-y-5">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <Skeleton className="aspect-square rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </Page>
    )
  }

  if (!item) {
    return (
      <Page className="space-y-5">
        <BackLink to="/catalog">Back to the Catalog</BackLink>
        <EmptyState
          mood="emptyBox"
          title="There is nothing here"
          body="This was never screened, or it has been taken away. The Catalog has plenty else."
          action={<Button to="/catalog" icon={faStore}>The Catalog</Button>}
        />
      </Page>
    )
  }

  return (
    <Page className="space-y-5">
      <BackLink to="/catalog">Back to the Catalog</BackLink>

      {/*
        * Capped and centred rather than "as wide as the page".
        *
        * It was a `1fr` square: on a wide screen that drew a 670-pixel box
        * around a thing the size of a hat, with the panel squeezed into a
        * corner and half the page empty underneath. A viewer is as big as it
        * needs to be to see the item, and the panel reads beside it.
        */}
      <div className="mx-auto grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <ItemView item={item} />

        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                  {KIND_WORDS[item.kind] ?? item.kind}
                </p>
                <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight">
                  {item.name}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {owned && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-space/15 px-2.5 py-1 text-[11px] font-bold text-space-bright">
                    <FontAwesomeIcon icon={faCircleCheck} />
                    Yours
                  </span>
                )}

                <button
                  type="button"
                  aria-label={starred ? 'Take the star off' : 'Star it'}
                  aria-pressed={starred}
                  disabled={!profile || profile.is_guest}
                  onClick={() => void star()}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    starred
                      ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                      : 'border-ink-line bg-ink-raised text-white/60 hover:text-white',
                  )}
                >
                  <FontAwesomeIcon icon={faStar} />
                  {stars > 0 && <span>{formatCount(stars)}</span>}
                </button>

                {/* Everything that is not buying it. */}
                <Menu
                  label="More"
                  align="right"
                  trigger={
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-raised text-white/60 transition-colors hover:bg-ink-hover hover:text-white">
                      <FontAwesomeIcon icon={faEllipsis} />
                    </span>
                  }
                  items={[
                    ...(owned ? [{ label: 'Wear it on my avatar', icon: faUser, to: '/avatar' }] : []),
                    { label: 'See who made it', icon: faUser, to: `/u/${item.creator_username}` },
                    { label: 'Report it', icon: faFlag, onSelect: () => setReporting(true) },
                    ...(canRemove ? [{
                      label: sureRemove ? 'Really take it down' : 'Take it down',
                      icon: faTrash,
                      danger: true,
                      onSelect: () => {
                        if (!sureRemove) { setSureRemove(true); return }
                        void (async () => {
                          setBusy(true)
                          try {
                            const back = await removeAvatarItem(item.id, 'Taken down by Kobblon.')
                            say(back > 0
                              ? `Taken down. ${back} Brix paid back.`
                              : 'Taken down.', 'success')
                            thing.reload()
                          } catch (error) {
                            say(error instanceof Error ? error.message : 'That did not work.', 'error')
                          } finally {
                            setBusy(false)
                            setSureRemove(false)
                          }
                        })()
                      },
                    }] : []),
                  ]}
                />
              </div>
            </div>

            <Link
              to={`/u/${item.creator_username}`}
              className="flex items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"
            >
              <span className="text-muted">By</span>
              <span className="truncate font-semibold text-white/90">
                {item.creator_display_name}
              </span>
              <NameMarks
                person={{
                  is_verified: item.creator_is_verified,
                  is_admin: item.creator_is_staff,
                }}
                className="text-[11px]"
              />
            </Link>

            {/*
              * A limited says which of its two states it is in, because they
              * are not the same sentence. Still selling and closing soon is
              * a reason to hurry; closed is a reason to stop looking for a
              * button. Hiding the second one is what makes somebody press a
              * button the server is about to refuse.
              */}
            {item.sells_until && (
              <p className={cn(
                'flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed',
                closed
                  ? 'border border-ink-line bg-ink-raised text-white/65'
                  : 'border border-amber-400/40 bg-amber-400/10 text-amber-200',
              )}>
                <FontAwesomeIcon icon={faClock} className="mt-0.5" />
                <span>
                  {closed ? (
                    <>This limited has closed. It still exists and everybody
                    who has one keeps it, but nobody can buy it now.</>
                  ) : (
                    <>A limited. It can be bought until{' '}
                    <span className="font-bold">
                      {new Date(item.sells_until).toLocaleString()}
                    </span>, and not after.</>
                  )}
                </span>
              </p>
            )}

            {!item.is_public && (
              <p className="rounded-xl border border-ink-line bg-ink-raised p-3 text-xs leading-relaxed text-white/65">
                This is not in the Catalog. You can see it because you made it.
              </p>
            )}

            {/*
              * One row: the thing you came to do, and the basket beside it.
              *
              * It was three stacked full-width buttons with a red one under
              * them, which made a shopping page read as a form. Buying is
              * the sentence; the basket is a square beside it because it is
              * the same act deferred; everything else is behind the dots in
              * the corner, which is where everything else goes.
              */}
            <div className="flex items-center gap-2">
              {closed && !owned ? (
                <Button className="flex-1" disabled>Closed</Button>
              ) : (
                <BuyButton
                  className="flex-1"
                  price={item.price}
                  owned={owned}
                  ownedLabel="Wear it"
                  freeLabel="Take it"
                  loading={busy}
                  disabled={!profile || profile.is_guest || !item.is_public}
                  onClick={() => (owned || item.price <= 0
                    ? void take()
                    : setConfirming(true))}
                />
              )}

              {!owned && !closed && item.is_public && (
                <button
                  type="button"
                  aria-label={put ? 'Take it out of your basket' : 'Put it in your basket'}
                  aria-pressed={put}
                  disabled={!profile || profile.is_guest}
                  onClick={() => (put
                    ? takeOutOfBasket(item.id)
                    : putInBasket({
                      id: item.id,
                      name: item.name,
                      kind: item.kind,
                      price: item.price,
                      picture: cardFor(item),
                    }))}
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    put
                      ? 'border-brand bg-brand/15 text-white'
                      : 'border-ink-line bg-ink-raised text-white/60 hover:border-brand/60 hover:text-white',
                  )}
                >
                  <FontAwesomeIcon icon={put ? faCheck : faBasketShopping} />
                </button>
              )}
            </div>

            {/*
              * The facts, as a table.
              *
              * Staw put our page beside two others that have one and ours
              * next to them read like a stub. What somebody wants to know
              * before spending Brix is what it is, where it goes, how long
              * it has been around and how many people already have it -
              * every one of those is a row we already hold and were not
              * showing.
              */}
            <dl className="divide-y divide-ink-line border-t border-ink-line text-sm">
              <Fact label="Number" value={avatarTag(item.kind, item.content_id)} />
              <Fact label="Type" value={KIND_WORDS[item.kind] ?? item.kind} />
              <Fact label="Worn" value={WHERE_WORDS[item.slot] ?? item.slot} />
              {item.created_at && (
                <Fact
                  label="Made"
                  value={new Date(item.created_at).toLocaleDateString(undefined, {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                />
              )}
              <Fact
                label="Taken"
                value={typeof item.taken === 'number' && item.taken > 0
                  ? (item.taken === 1 ? '1 person has it' : `${item.taken} people have it`)
                  : 'Nobody yet'}
              />
              <Fact
                label="Price"
                value={item.price > 0
                  ? <span className="inline-flex items-center gap-0.5">
                      <CurrencyMark />{item.price}
                    </span>
                  : 'Free'}
              />
            </dl>
          </Card>

          {item.description && (
            <Card className="space-y-2 p-5">
              <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                About it
              </p>
              {/*
                * Plain text, deliberately. A description is written by
                * whoever made the item, and user writing is never rendered
                * as trusted markup - `whitespace-pre-wrap` keeps their line
                * breaks without keeping anything else.
                */}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
                {item.description}
              </p>
            </Card>
          )}
        </div>
      </div>

      <MoreLikeThis item={item} />

      {/*
        * Asked before the Brix move, and only when there are Brix to move:
        * confirming a free thing is a dialog that teaches somebody to press
        * through dialogs.
        */}
      <Confirm
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => { setConfirming(false); await take() }}
        title={`Buy ${item.name}?`}
        lead={`It costs ${item.price} Brix, and it is yours to keep.`}
        points={[
          `You have ${formatCount(profile?.pixels ?? 0)} Brix.`,
          ...(item.sells_until && !closed
            ? [`A limited: it stops selling on ${new Date(item.sells_until).toLocaleDateString()}.`]
            : []),
        ]}
        confirmText="Buy it"
        tone="primary"
      />

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="avatar_item"
        targetId={item.id}
        targetName={item.name}
      />
    </Page>
  )
}

/** One row of the facts table. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right font-semibold text-white/85">{value}</dd>
    </div>
  )
}

/**
 * Other things of the same kind.
 *
 * Both of the shops Staw put ours beside end with one of these, and the
 * reason is not decoration: somebody looking at a hat they have decided
 * against should land on another hat rather than on a dead end. The same
 * shelf reader the Catalog uses, filtered to this kind, with this one
 * dropped out of it.
 */
function MoreLikeThis({ item }: { item: AvatarItem }) {
  const others = useAsync(
    async () => avatarShelf(item.kind, undefined, 12, null, 'taken'),
    [item.kind],
  )

  const rest = (others.data ?? []).filter((one) => one.id !== item.id).slice(0, 6)
  if (others.loading || rest.length === 0) return null

  return (
    <section className="mx-auto w-full max-w-5xl space-y-3">
      <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted">
        More {(KIND_WORDS[item.kind] ?? item.kind).toLowerCase()}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {rest.map((one) => {
          const picture = cardFor(one)
          return (
            <Link
              key={one.id}
              to={`/catalog/${avatarTag(one.kind, one.content_id)}`}
              className="overflow-hidden rounded-xl border border-ink-line bg-ink-card transition-colors hover:border-brand/60"
            >
              <span className="grid aspect-square place-items-center overflow-hidden bg-ink-raised">
                {picture
                  ? <img src={picture} alt="" loading="lazy" className="h-full w-full object-contain p-2" />
                  : <FontAwesomeIcon icon={faShirt} className="text-2xl text-white/20" />}
              </span>
              <span className="block space-y-0.5 p-2">
                <span className="block truncate text-xs font-bold">{one.name}</span>
                <span className="block text-[11px] text-muted">
                  {one.price > 0
                    ? <span className="inline-flex items-center gap-0.5">
                        <CurrencyMark />{one.price}
                      </span>
                    : 'Free'}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

/**
 * The thing itself, flat or on a body.
 *
 * Which of those "flat" means depends on the kind, and that is Staw's rule
 * rather than a simplification: clothes are shown on a body even flat,
 * because the picture of a shirt is the template it was painted into and
 * reads as a jumble of rectangles. A face and an accessory are their own
 * picture flat, and go on a body only in 3D.
 */
function ItemView({ item }: { item: AvatarItem }) {
  const { profile } = useAuth()

  /*
   * Three ways of looking at it, which is Staw's spec and not a flourish:
   *
   *   picture  - the drawn card. Flat, instant, and what a shelf shows.
   *   body     - on a plain mannequin, so two people comparing the same
   *              shirt are comparing the same picture.
   *   me       - on the person looking at it, over what they already wear,
   *              which is the only view that answers "does this suit me".
   *
   * `me` is offered only to somebody signed in, because there is nobody to
   * put it on otherwise. It had regressed to a two-way switch that
   * disappeared entirely for clothes and faces - I gated it on having a
   * mesh, and a shirt has none.
   */
  const [mode, setMode] = useState<'picture' | 'body' | 'me'>('picture')
  // The face the mannequin wears, so every rig on the site is the same one.
  const [face, setFace] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    void mannequinFace().then((picture) => { if (live) setFace(picture) })
    return () => { live = false }
  }, [])
  const [model, setModel] = useState<{ mesh: string | null; skin: string | null } | null>(null)

  const flat = cardFor(item) ?? null

  /** Whether it can be put on a body at all: a model, or a picture to lay on. */
  const canRig = !!item.mesh_path || !!item.image_path

  /*
   * The model is fetched the first time somebody asks to see it worn, not on
   * the way in. A signed address is a request each, and most people look at
   * the picture and leave.
   */
  useEffect(() => {
    if (mode === 'picture' || model || !item.mesh_path) return
    let live = true
    void (async () => {
      const [mesh, skin] = await Promise.all([
        assetUrl(item.mesh_path!).catch(() => null),
        item.texture_path ? assetUrl(item.texture_path).catch(() => null) : null,
      ])
      if (live) setModel({ mesh, skin })
    })()
    return () => { live = false }
  }, [mode, model, item.mesh_path, item.texture_path])

  /** This item as a piece, whichever body it is going on. */
  const asPiece = useMemo(() => ({
    slot: item.slot,
    kind: item.kind,
    name: item.name,
    imageUrl: item.mesh_path
      ? null
      : catalogUrl(item.image_path, item.image_bucket ?? undefined),
    meshUrl: model?.mesh ?? null,
    meshFormat: item.mesh_format ?? null,
    textureUrl: model?.skin ?? null,
    // Where its maker put it, not where the measuring did.
    fit: item.fit ?? null,
  }), [item, model])

  /*
   * The viewer's own avatar, fetched the first time they ask to see it on
   * themselves. Their colours and everything they wear, with this item put
   * on top - so a hat replaces the hat they have on rather than sitting
   * beside it, which is what the slot does for free.
   */
  const mine = useAsync(
    async () => (mode === 'me' && profile ? avatarOf(profile.id) : null),
    [mode, profile?.id],
  )

  const onMe = useMemo<AvatarLook | null>(() => {
    if (!mine.data) return null
    const worn = mine.data
      .filter((piece) => piece.slot && piece.slot !== item.slot && !piece.mesh_path)
      .map((piece) => ({
        slot: piece.slot!,
        kind: piece.kind ?? '',
        imageUrl: catalogUrl(piece.image_path, piece.image_bucket ?? undefined),
      }))
    return {
      body: mine.data[0]?.body ?? MANNEQUIN_BODY,
      pieces: [...worn, asPiece],
    }
  }, [mine.data, asPiece, item.slot])

  const look = useMemo<AvatarLook>(
    () => ({
      body: MANNEQUIN_BODY,
      pieces: [
        ...(face ? [{ slot: 'face', kind: 'face', imageUrl: face }] : []),
        asPiece,
      ],
    }),
    [asPiece, face],
  )

  const waiting = (!!item.mesh_path && !model?.mesh) || (mode === 'me' && mine.loading)

  /*
   * Opening on a body when there is no flat picture to open on. An accessory
   * whose card has not been drawn had nothing to show, and a shirt icon in
   * the middle of an enormous empty square reads as broken. 2D stays the
   * default wherever a picture exists, which is Staw's rule.
   */
  useEffect(() => {
    if (!flat && canRig) setMode('body')
  }, [flat, canRig])

  const showing = mode === 'me' ? (onMe ?? look) : look

  const WAYS = [
    { value: 'picture' as const, icon: faImage, label: 'Picture', on: !!flat },
    { value: 'body' as const, icon: faCube, label: '3D', on: canRig },
    { value: 'me' as const, icon: faUser, label: 'On me', on: canRig && !!profile && !profile.is_guest },
  ].filter((one) => one.on)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-line bg-ink-card">
      <div className="relative grid aspect-square place-items-center overflow-hidden bg-ink-raised">
        {!item.price && <FreeCorner />}

        {mode !== 'picture' ? (
          waiting
            ? <Skeleton className="h-full w-full" />
            : <AvatarStage look={showing} turning={false} handled className="h-full w-full" />
        ) : flat ? (
          <img
            src={flat}
            alt={item.name}
            draggable={false}
            className="h-full w-full select-none object-contain p-6"
          />
        ) : (
          <p className="max-w-[18rem] px-6 text-center text-sm leading-relaxed text-muted">
            <FontAwesomeIcon icon={faShirt} className="mb-2 block text-2xl text-white/20" />
            No picture of this one yet. Its maker&rsquo;s card is drawn the next
            time they open Things to Wear.
          </p>
        )}
      </div>

      {/*
        * The three ways, in the corner `MeshView` puts its switch. A row of
        * them rather than one cycling button: with three states a single
        * button cannot say where it will take you.
        */}
      {WAYS.length > 1 && (
        <div className="absolute bottom-2 right-2 flex items-center gap-0.5 rounded-full border border-white/20 bg-ink/80 p-0.5 backdrop-blur-sm">
          {WAYS.map((way) => (
            <button
              key={way.value}
              type="button"
              aria-pressed={mode === way.value}
              onClick={() => setMode(way.value)}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition-colors',
                mode === way.value
                  ? 'bg-brand text-white'
                  : 'text-white/65 hover:text-white',
              )}
            >
              <FontAwesomeIcon icon={way.icon} />
              <span>{way.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

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
  faBasketShopping, faCheck, faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BackLink } from '@/components/ui/BackLink'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { BuyButton } from '@/components/money/BuyButton'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { Verified, isVerified } from '@/components/brand/Verified'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import {
  avatarItemPage, buyAvatarItem, wearAvatarItem, cardFor, catalogUrl, assetUrl,
  removeAvatarItem,
} from '@/lib/api'
import { avatarTag, avatarNumber } from '@/lib/kinds'
import { useBasket, putInBasket, takeOutOfBasket } from '@/hooks/useBasket'
import type { AvatarItem } from '@/types/db'
import { cn } from '@/lib/cn'

const KIND_WORDS: Record<string, string> = {
  shirt: 'Shirt', trousers: 'Trousers', tdecal: 'T-decal',
  accessory: 'Accessory', hair: 'Hair', face: 'Face',
}

/*
 * A plain body to show things on, rather than the visitor's own.
 *
 * Deliberate: a card that changed with whoever was looking at it would mean
 * two people comparing the same shirt are comparing two different pictures,
 * and somebody signed out would see nothing at all.
 */
const MANNEQUIN: Record<string, string> = {
  Head: '#f2d08a', Torso: '#2a2f45', LeftArm: '#f2d08a',
  RightArm: '#f2d08a', LeftLeg: '#1b1d28', RightLeg: '#1b1d28',
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
          <Card className="space-y-4">
            <div>
              <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                {KIND_WORDS[item.kind] ?? item.kind}
              </p>
              <h1 className="mt-1 font-display text-2xl font-extrabold">{item.name}</h1>
              <p className="mt-1 text-xs text-muted">
                {avatarTag(item.kind, item.content_id)}
              </p>
            </div>

            <Link
              to={`/u/${item.creator_username}`}
              className="flex items-center gap-1.5 text-sm text-white/75 transition-colors hover:text-white"
            >
              <FontAwesomeIcon icon={faUser} className="text-xs text-white/40" />
              <span className="truncate">{item.creator_display_name}</span>
              {isVerified({ is_verified: item.creator_is_verified }) && (
                <Verified className="text-[10px]" />
              )}
            </Link>

            {item.description && (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">
                {item.description}
              </p>
            )}

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

            <div className="space-y-2">
              {closed && !owned ? (
                <Button block disabled>Closed</Button>
              ) : (
                <BuyButton
                  block
                  price={item.price}
                  owned={owned}
                  ownedLabel="Wear it"
                  freeLabel="Take it"
                  loading={busy}
                  disabled={!profile || profile.is_guest || !item.is_public}
                  onClick={() => void take()}
                />
              )}
              {!owned && !closed && item.is_public && (
                <Button
                  block
                  variant="subtle"
                  icon={put ? faCheck : faBasketShopping}
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
                >
                  {put ? 'In your basket' : 'Put it in your basket'}
                </Button>
              )}
              {owned && (
                <Button block variant="subtle" to="/avatar" icon={faUser}>
                  My Avatar
                </Button>
              )}
            </div>

            {canRemove && (
              <div className="space-y-1.5 border-t border-ink-line pt-3">
                <Button
                  block
                  variant="danger"
                  icon={faTrash}
                  loading={busy}
                  onClick={() => {
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
                  }}
                >
                  {sureRemove ? 'Really take it down' : 'Take it down'}
                </Button>
                <p className="text-[11px] leading-snug text-muted">
                  It stops being sold and comes off everybody wearing it.
                  Everybody who bought it is paid back 40% of what they paid,
                  out of Kobblon&rsquo;s account.
                </p>
              </div>
            )}

            {typeof item.taken === 'number' && item.taken > 0 && (
              <p className="text-xs text-muted">
                {item.taken === 1 ? '1 person has this' : `${item.taken} people have this`}
              </p>
            )}
          </Card>
        </div>
      </div>
    </Page>
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
  const [mode, setMode] = useState<'2d' | '3d'>('2d')
  const [model, setModel] = useState<{ mesh: string | null; skin: string | null } | null>(null)

  const picture = cardFor(item)

  /*
   * The model is fetched the first time somebody asks for 3D, not on the way
   * in. A signed address is a request each, and most people look at the
   * picture and leave.
   */
  useEffect(() => {
    if (mode !== '3d' || model || !item.mesh_path) return
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

  const look = useMemo<AvatarLook>(() => ({
    body: MANNEQUIN,
    pieces: [{
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
    }],
  }), [item, model])

  const ready = !item.mesh_path || !!model?.mesh
  /*
   * Opening in 3D when there is no flat picture to open on.
   *
   * An accessory whose card has not been drawn yet had nothing to show, so
   * the page drew a shirt icon in the middle of an enormous empty square -
   * which reads as broken, and is the thing Staw saw. The model is right
   * there and showing it is both honest and better. 2D stays the default
   * wherever a picture exists, which is Staw's rule.
   */
  const flat = picture ?? null
  useEffect(() => {
    if (!flat && item.mesh_path) setMode('3d')
  }, [flat, item.mesh_path])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-line bg-ink-card">
      <div className="relative grid aspect-square place-items-center overflow-hidden bg-ink-raised">
        {!item.price && <FreeCorner />}

        {mode === '3d' ? (
          ready ? (
            <AvatarStage look={look} turning={false} handled className="h-full w-full" />
          ) : (
            <Skeleton className="h-full w-full" />
          )
        ) : flat ? (
          <img
            src={flat}
            alt={item.name}
            draggable={false}
            className="h-full w-full select-none object-contain p-6"
          />
        ) : (
          /*
           * Nothing to draw at all: no card and no model. Said in words
           * rather than as a lonely icon, because an icon in the middle of a
           * large empty box reads as a page that failed to load.
           */
          <p className="max-w-[18rem] px-6 text-center text-sm leading-relaxed text-muted">
            <FontAwesomeIcon icon={faShirt} className="mb-2 block text-2xl text-white/20" />
            No picture of this one yet. Its maker&rsquo;s card is drawn the next
            time they open Things to Wear.
          </p>
        )}
      </div>

      {/* The switch `MeshView` has, in the same corner and the same shape. */}
      {/*
        * Only when there are two things to switch between. A model with no
        * card had a "Picture" button that showed an apology, and a picture
        * with no model had a "3D" button that drew a bare mannequin.
        */}
      {flat && item.mesh_path && (
      <button
        type="button"
        aria-label={mode === '3d' ? 'Show the picture' : 'See it on a body'}
        onClick={() => setMode(mode === '3d' ? '2d' : '3d')}
        className={cn(
          'absolute bottom-2 right-2 flex h-9 items-center gap-2 rounded-full px-3.5',
          'border border-white/20 bg-ink/80 text-xs font-bold text-white/75 backdrop-blur-sm',
          'transition-colors hover:border-brand hover:bg-brand hover:text-white',
        )}
      >
        <FontAwesomeIcon icon={mode === '3d' ? faImage : faCube} />
        <span>{mode === '3d' ? 'Picture' : '3D'}</span>
      </button>
      )}
    </div>
  )
}

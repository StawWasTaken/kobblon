/*
 * One saved outfit, on its own page - the same page an accessory gets.
 *
 * Staw: "for the outfit asset pages i want them unified to the other
 * catalog asset pages like for accessories (do the same design as for
 * accessories but as outfits)". So this is `CatalogItem`'s shape, measure
 * for measure: the capped five-column width, the square viewer on the left
 * in its own bordered card, the panel on the right with the kind word over
 * the name, the buy row, the facts table, the maker line, and the same
 * `BuyDialog` at the end of it.
 *
 * What an outfit has that an item does not is that it is made of other
 * things, and each of those has a page. So the one section that is not on
 * the item page is the list of pieces, and every line of it is a link - the
 * thing the shelf card could never do, which printed four names that went
 * nowhere.
 *
 * The viewer is `OutfitStage`, which is `AvatarStage` fed `outfit_look`.
 * Not a picture of the outfit: the outfit, on a body, from any angle.
 */
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faShirt, faStore, faCheck, faUser, faLink, faFlag, faCircleCheck,
  faEllipsis, faImage, faCube, faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BackLink } from '@/components/ui/BackLink'
import { Menu } from '@/components/ui/Menu'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { BuyButton } from '@/components/money/BuyButton'
import { BuyDialog } from '@/components/catalog/BuyDialog'
import { ReportDialog } from '@/components/social/ReportDialog'
import { NameMarks } from '@/components/brand/Verified'
import { CurrencyMark } from '@/components/brand/Currency'
import { FreeCorner } from '@/components/brand/FreeBadge'
import { OutfitStage } from '@/components/avatar/OutfitStage'
import { ViewSwitch } from '@/components/avatar/ViewSwitch'
import { Recommended } from '@/components/catalog/Recommended'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { outfitPage, buyOutfit, wearOutfit, catalogUrl, takeDownOutfit } from '@/lib/api'
import { avatarTag, avatarNumber, outfitTag, avatarKindLabels } from '@/lib/kinds'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

export default function OutfitPage() {
  const { tag } = useParams<{ tag: string }>()
  const { profile } = useAuth()
  const say = useToast()
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [reporting, setReporting] = useState(false)
  /** Which way it is being looked at: in three dimensions, or flat. */
  const [mode, setMode] = useState<'picture' | 'body'>('body')
  /** Staff only, and asked twice, the way the item page asks. */
  const [sureRemove, setSureRemove] = useState(false)

  const number = avatarNumber(tag ?? '')
  const outfit = useAsync(
    async () => (number ? outfitPage(number) : null),
    [number],
  )

  useTitle(outfit.data?.name ?? 'Outfit')

  /**
   * Buying the whole thing: every piece they do not already own, then it
   * goes on. The money, the two cuts and the all-or-nothing are the
   * database's - `buy_outfit` either takes the lot or takes nothing.
   */
  const take = async () => {
    const one = outfit.data
    if (!one) return
    setBusy(true)
    try {
      if (!one.mine) await buyOutfit(one.id)
      await wearOutfit(one.id)
      say(one.mine ? `${one.name} is on.` : `${one.name} is yours and on.`, 'success')
      outfit.reload()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  if (outfit.loading) {
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

  const one = outfit.data
  if (!one) {
    return (
      <Page className="space-y-5">
        <BackLink to="/catalog">Back to the Catalog</BackLink>
        <EmptyState
          mood="noResults"
          title="No such outfit"
          body="It may have been taken down, or it was never listed."
          action={<Button to="/catalog" icon={faStore}>The Catalog</Button>}
        />
      </Page>
    )
  }

  /*
   * What it will actually charge, which is not the listed price when
   * somebody already owns half of it. The same sum the shelf does and the
   * same sum `buy_outfit` does: a page that quotes a different number from
   * the one charged is worse than a page with no number on it.
   */
  const costs = one.mine ? 0 : one.costs
  const canTakeDown = !!profile?.is_moderator || !!profile?.is_admin

  return (
    <Page className="space-y-5">
      <BackLink to="/catalog?shelf=outfits">Back to the Catalog</BackLink>

      <div className="mx-auto grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        {/* ----------------------------------------------------- the viewer */}
        <div className="relative rounded-2xl border border-ink-line bg-ink-card">
          {/* Outside the box that clips, which is where it has to be: the
              badge sits half on and half off the corner. */}
          {costs <= 0 && !one.mine && <FreeCorner size="page" />}
          <div className="relative grid aspect-square place-items-center overflow-hidden rounded-2xl bg-ink-raised">
            <OutfitStage
              outfitId={one.id}
              flat={mode === 'picture'}
              handled
              className="h-full w-full"
            />
            {/* The Catalog's own switch, because this is the Catalog's own
                page and an outfit is an asset like the rest of them. */}
            <ViewSwitch
              ways={[
                { value: 'picture' as const, icon: faImage, label: '2D' },
                { value: 'body' as const, icon: faCube, label: '3D' },
              ]}
              value={mode}
              onChange={setMode}
            />
          </div>
        </div>

        {/* ------------------------------------------------------ the panel */}
        <div className="space-y-4">
          <Card className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-[10px] uppercase tracking-wider text-muted">
                  Outfit
                </p>
                <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight">
                  {one.name}
                </h1>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {one.mine && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-space/15 px-2.5 py-1 text-[11px] font-bold text-space-bright">
                    <Glyph icon={faCircleCheck} />
                    Yours
                  </span>
                )}

                <Menu
                  label="More"
                  align="right"
                  trigger={
                    <span className="grid h-8 w-8 place-items-center rounded-lg border border-ink-line bg-ink-raised text-white/60 transition-colors hover:bg-ink-hover hover:text-white">
                      <Glyph icon={faEllipsis} />
                    </span>
                  }
                  items={[
                    ...(one.mine ? [{
                      label: 'Change it on my avatar',
                      icon: faUser,
                      to: '/avatar',
                    }] : []),
                    {
                      label: 'Copy link',
                      icon: faLink,
                      onSelect: () => {
                        void navigator.clipboard?.writeText(window.location.href)
                        say('Link copied.', 'success')
                      },
                    },
                    { label: 'See who made it', icon: faUser, to: `/u/${one.owner_username}` },
                    { label: 'Report it', icon: faFlag, danger: true, onSelect: () => setReporting(true) },
                    /*
                     * Staff only, asked twice, and the same wording the
                     * item page uses - "and to take down stuff". The
                     * server refuses anybody else, so this only saves a
                     * moderator a round trip rather than being the rule.
                     */
                    ...(canTakeDown ? [{
                      label: sureRemove ? 'Really take it down' : 'Take it down',
                      icon: faTrash,
                      danger: true,
                      onSelect: () => {
                        if (!sureRemove) { setSureRemove(true); return }
                        void (async () => {
                          setBusy(true)
                          try {
                            await takeDownOutfit(one.id, 'Taken down by Kobblon.')
                            say('Taken down.', 'success')
                            outfit.reload()
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
              to={`/u/${one.owner_username}`}
              className="flex items-center gap-2 text-sm text-white/75 transition-colors hover:text-white"
            >
              <span className="text-muted">By</span>
              <span className="truncate font-semibold text-white/90">
                {one.owner_display_name}
              </span>
              <NameMarks
                person={{
                  is_verified: one.owner_is_verified,
                  is_admin: one.owner_is_staff,
                }}
                className="text-[11px]"
              />
            </Link>

            <div className="flex items-center gap-2">
              <BuyButton
                className="flex-1"
                price={costs}
                owned={one.mine}
                ownedLabel="Wear it"
                freeLabel="Take it"
                loading={busy}
                disabled={!profile || profile.is_guest}
                onClick={() => (one.mine || costs <= 0
                  ? void take()
                  : setConfirming(true))}
              />
            </div>

            {one.owned_already > 0 && !one.mine && (
              <p className="text-xs leading-relaxed text-muted">
                You already have {one.owned_already} of the {one.how_many}, so you
                are only charged for the rest.
              </p>
            )}

            {/*
              * The facts, as a table - the same one the item page has, with
              * the two rows an outfit answers differently. An outfit's
              * "Worn" is everywhere at once, so it says how many pieces
              * instead; and its price is the sum of what is left to buy.
              */}
            <dl className="divide-y divide-ink-line border-t border-ink-line text-sm">
              <Fact label="ID" value={outfitTag(one.content_id)} />
              <Fact label="Type" value="Outfit" />
              <Fact
                label="Pieces"
                value={`${one.how_many} ${one.how_many === 1 ? 'thing' : 'things'}`}
              />
              <Fact
                label="Made"
                value={new Date(one.created_at).toLocaleDateString(undefined, {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              />
              <Fact
                label="Price"
                value={costs > 0
                  ? (
                    <span className="inline-flex items-center gap-1.5">
                      {/* The listed price stays, struck through, when
                          somebody already owns part of it: a smaller number
                          with no explanation reads like a mistake. */}
                      {one.owned_already > 0 && one.price > costs && (
                        <span className="text-muted line-through">
                          <CurrencyMark />{formatCount(one.price)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5">
                        <CurrencyMark />{formatCount(costs)}
                      </span>
                    </span>
                  )
                  : 'Free'}
              />
            </dl>
          </Card>

          {/*
            * Every piece, and every one of them a link.
            *
            * This is the one section the item page does not have, and the
            * thing the shelf card could not do: it listed four names and
            * none of them went anywhere, so the only way to find out what
            * "Traffic Wizard" actually was involved searching for it.
            */}
          <Card className="space-y-3 p-5">
            <p className="font-display text-[10px] uppercase tracking-wider text-muted">
              What is in it
            </p>
            <ul className="space-y-2">
              {one.pieces.map((piece) => (
                <li key={piece.item_id}>
                  <Link
                    to={`/catalog/${avatarTag(piece.kind, piece.content_id)}`}
                    className="flex items-center gap-3 rounded-xl border border-ink-line bg-ink-raised p-2.5 transition-colors hover:border-brand/60"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-media">
                      {pictureOf(piece) ? (
                        <img
                          src={pictureOf(piece)!}
                          alt=""
                          draggable={false}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <Glyph icon={faShirt} className="text-white/30" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{piece.name}</span>
                      <span className="block text-[11px] text-muted">
                        {avatarKindLabels[piece.kind] ?? piece.kind}
                      </span>
                    </span>
                    <span className={cn(
                      'shrink-0 text-xs font-bold',
                      piece.owned ? 'text-space-bright' : 'text-white/85',
                    )}>
                      {piece.owned ? (
                        <Glyph icon={faCheck} />
                      ) : piece.price > 0 ? (
                        <span className="inline-flex items-center gap-0.5">
                          <CurrencyMark />{formatCount(piece.price)}
                        </span>
                      ) : 'Free'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/*
        * The same shelf every other asset page ends with, so a person
        * leaving an outfit lands somewhere rather than nowhere.
        */}
      <Recommended className="mx-auto w-full max-w-5xl" />

      {/*
        * Asked before the Brix move, and only when there are Brix to move:
        * confirming a free thing is a dialog that teaches somebody to press
        * through dialogs.
        */}
      <BuyDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onBuy={async () => { setConfirming(false); await take() }}
        busy={busy}
        name={one.name}
        kind="outfit"
        price={costs}
        balance={profile?.pixels ?? 0}
        note={one.owned_already > 0
          ? `You already have ${one.owned_already} of the ${one.how_many}, so only the rest is charged.`
          : `It buys all ${one.how_many} pieces at once, or none of them.`}
      />

      <ReportDialog
        open={reporting}
        onClose={() => setReporting(false)}
        targetType="outfit"
        targetId={one.id}
        targetName={one.name}
      />
    </Page>
  )
}

/** One row of the facts table. The item page's, word for word. */
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

/** A piece's picture: its drawn card if it has one, its own image if not. */
function pictureOf(piece: {
  image_path: string | null
  image_bucket: string | null
  preview_path: string | null
}) {
  return piece.preview_path
    ? catalogUrl(piece.preview_path)
    : catalogUrl(piece.image_path, piece.image_bucket ?? undefined)
}

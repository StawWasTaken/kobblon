/*
 * One saved outfit, on its own page.
 *
 * Staw: "the outfits on the catalog should be in 3d too and have their own
 * asset page like others". Everything else in the Catalog has had a page
 * since `avatar_item_page`; an outfit had a shelf card with four names on
 * it and nowhere to go. So this is the same page shape an item gets - the
 * thing itself, large and turnable, on the left; what it is, who made it
 * and what it costs on the right - with the one difference an outfit has:
 * it is made of other things, and each of them has its own page, so every
 * piece is a link rather than a line of text.
 *
 * The figure is `OutfitStage`, which is `AvatarStage` fed `outfit_look`.
 * Not a picture of the outfit: the outfit, on a body, from any angle.
 */
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faShirt, faStore, faCheck, faUser, faClock, faLayerGroup,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { BackLink } from '@/components/ui/BackLink'
import { Badge } from '@/components/ui/Badge'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { BuyButton } from '@/components/money/BuyButton'
import { BuyDialog } from '@/components/catalog/BuyDialog'
import { NameMarks } from '@/components/brand/Verified'
import { CurrencyMark } from '@/components/brand/Currency'
import { Studio } from '@/components/avatar/Studio'
import { OutfitStage } from '@/components/avatar/OutfitStage'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'
import { outfitPage, buyOutfit, wearOutfit, catalogUrl } from '@/lib/api'
import { avatarTag, avatarNumber, avatarKindLabels } from '@/lib/kinds'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'

export default function OutfitPage() {
  const { tag } = useParams<{ tag: string }>()
  const { profile } = useAuth()
  const say = useToast()
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)

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
      setAsking(false)
    }
  }

  if (outfit.loading) {
    return (
      <Page className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
          <Skeleton className="aspect-square rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </Page>
    )
  }

  const one = outfit.data
  if (!one) {
    return (
      <Page>
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

  return (
    <Page className="space-y-4">
      <BackLink to="/catalog?shelf=outfits">The Catalog</BackLink>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        {/* ------------------------------------------------------ the look */}
        <Card className="overflow-hidden p-0">
          <Studio>
            <OutfitStage outfitId={one.id} className="aspect-square w-full" />
          </Studio>
        </Card>

        {/* ------------------------------------------------- what it is */}
        <div className="space-y-4">
          <Card className="space-y-3">
            <div>
              <h1 className="font-display text-xl font-bold">{one.name}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                <FontAwesomeIcon icon={faUser} className="text-[11px]" />
                <Link
                  to={`/u/${one.owner_username}`}
                  className="font-bold text-ink-strong hover:text-brand-bright"
                >
                  {one.owner_display_name}
                </Link>
                <NameMarks
                  person={{
                    is_verified: one.owner_is_verified,
                    has_staff_badge: one.owner_is_staff,
                  }}
                  className="text-[10px]"
                />
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge tone="neutral">
                <FontAwesomeIcon icon={faLayerGroup} className="mr-1 text-[10px]" />
                {one.how_many} {one.how_many === 1 ? 'piece' : 'pieces'}
              </Badge>
              <Badge tone="neutral">
                <FontAwesomeIcon icon={faClock} className="mr-1 text-[10px]" />
                {timeAgo(one.created_at)}
              </Badge>
              <Badge tone="neutral">{avatarTagFor(one.content_id)}</Badge>
            </div>

            {one.owned_already > 0 && !one.mine && (
              <p className="text-xs text-muted">
                You already have {one.owned_already} of {one.how_many}, so you
                are only charged for the rest.
              </p>
            )}

            {one.mine ? (
              <Button
                className="w-full"
                variant="yes"
                icon={faShirt}
                loading={busy}
                onClick={() => void take()}
              >
                Wear it
              </Button>
            ) : (
              <BuyButton
                className="w-full"
                price={costs}
                freeLabel="Wear it"
                loading={busy}
                disabled={!profile}
                onClick={() => (costs > 0 ? setAsking(true) : void take())}
              />
            )}

            {!profile && (
              <p className="text-center text-xs text-muted">
                <Link to="/login" className="font-bold text-ink-strong hover:text-brand-bright">
                  Sign in
                </Link>{' '}
                to put this on.
              </p>
            )}
          </Card>

          {/*
            * Every piece, and every one of them a link.
            *
            * This is the thing the shelf card could not do: it listed four
            * names and none of them went anywhere, so the only way to find
            * out what "Traffic Wizard" actually was involved searching the
            * Catalog for it by hand.
            */}
          <Card className="space-y-2 p-3">
            <p className="font-display text-[10px] uppercase tracking-wider text-muted">
              What is in it
            </p>
            <ul className="space-y-1.5">
              {one.pieces.map((piece) => (
                <li key={piece.item_id}>
                  <Link
                    to={`/catalog/${avatarTag(piece.kind, piece.content_id)}`}
                    className="flex items-center gap-2.5 rounded-xl border border-ink-line bg-ink-raised p-2 transition-colors hover:border-brand/60"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-media">
                      {pictureOf(piece) ? (
                        <img
                          src={pictureOf(piece)!}
                          alt=""
                          draggable={false}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <FontAwesomeIcon icon={faShirt} className="text-white/30" />
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
                      piece.owned ? 'text-yes' : 'text-ink-strong',
                    )}>
                      {piece.owned ? (
                        <FontAwesomeIcon icon={faCheck} />
                      ) : piece.price > 0 ? (
                        <><CurrencyMark className="mr-0.5 h-[0.9em] w-[0.9em]" />{formatCount(piece.price)}</>
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
        * The same confirm card the rest of the Catalog uses. An outfit is
        * the most expensive single press on the site - it buys several
        * things at once - so it is the last place that should have its own
        * idea of what buying looks like.
        */}
      <BuyDialog
        open={asking}
        onClose={() => setAsking(false)}
        onBuy={() => void take()}
        busy={busy}
        name={one.name}
        kind="outfit"
        price={costs}
        balance={profile?.pixels ?? 0}
        note={one.owned_already > 0
          ? `You already have ${one.owned_already} of the ${one.how_many}, so only the rest is charged.`
          : undefined}
      />
    </Page>
  )
}

/** The number a person reads off the page, with the outfit code in front. */
const avatarTagFor = (id: number) => `OUTF-${id}`

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

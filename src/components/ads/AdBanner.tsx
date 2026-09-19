import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRectangleAd, faArrowRight, faFlag } from '@fortawesome/free-solid-svg-icons'
import { ReportDialog } from '@/components/social/ReportDialog'
import { useAuth } from '@/hooks/useAuth'
import { assetUrl, pickAd, recordAdClick } from '@/lib/api'
import type { AdSize, ShownAd } from '@/lib/api'
import { AD_SIZES } from '@/lib/ads'
import { cn } from '@/lib/cn'
import { overlayChip, overlayButton } from '@/lib/overlay'

/*
 * Ads on a page.
 *
 * A page can hold more than one, and two slots showing the same picture reads
 * as one ad repeated rather than as advertising. So the asking is done in one
 * place: requests are taken in turn, each one is told what is already on the
 * page, and the database passes over those while it has anything else to
 * show. Slots still ask for themselves, which keeps each one honest about
 * what it is showing.
 */
type Asker = (size: AdSize, spaceId?: string | null) => Promise<ShownAd | null>

const AdsOnPage = createContext<Asker>(
  (size, spaceId) => pickAd(size, spaceId ?? null),
)

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const shown = useRef<Set<string>>(new Set())
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const ask = useMemo<Asker>(() => (size, spaceId) => {
    const next = queue.current.then(async () => {
      const found = await pickAd(size, spaceId ?? null, [...shown.current])
      if (found) shown.current.add(found.id)
      return found
    })
    // One slot failing must not jam the queue behind it.
    queue.current = next.catch(() => null)
    return next
  }, [])

  return <AdsOnPage.Provider value={ask}>{children}</AdsOnPage.Provider>
}

/**
 * The one ad for a slot of this size, and the link to its picture. Asking is
 * what counts a view, so it happens once per slot and never in a loop.
 */
export function useAd(size: AdSize, spaceId?: string | null) {
  const ask = useContext(AdsOnPage)
  const [ad, setAd] = useState<ShownAd | null>(null)
  const [picture, setPicture] = useState<string | null>(null)
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    let live = true

    ask(size, spaceId)
      .then(async (found) => {
        if (!live) return
        setAsked(true)
        if (!found) return
        const url = await assetUrl(found.file_path, 3600).catch(() => null)
        if (!live || !url) return
        setAd(found)
        setPicture(url)
      })
      .catch(() => { if (live) setAsked(true) })

    return () => { live = false }
  }, [ask, size, spaceId])

  return { ad, picture, asked }
}

/**
 * An ad in a page.
 *
 * It sits in the page rather than beside it, in a frame that says what it is:
 * a thin panel, a small word above it, and the thing itself. Nothing about it
 * pretends to be part of what the page is for.
 */
export function AdBanner({
  size = 'banner', className, quiet, fill, spaceId,
}: {
  size?: AdSize
  className?: string
  /** Leave nothing behind when there is no ad, rather than inviting one. */
  quiet?: boolean
  /** Take the shape of whatever holds it, for a slot in a grid. */
  fill?: boolean
  /** The Space this slot sits in, which is what earns a share of the view. */
  spaceId?: string | null
}) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [reporting, setReporting] = useState(false)
  const { ad, picture, asked } = useAd(size, spaceId)

  const shape = AD_SIZES[size]
  /*
   * A tall one is six hundred pixels high, which is taller than plenty of
   * screens. Capping its height against the window keeps the whole of it on
   * screen: the shape is held, so it simply comes out smaller rather than
   * losing its bottom.
   */
  const frame = fill
    ? { width: '100%', height: '100%' }
    : {
        maxWidth: shape.w,
        aspectRatio: `${shape.w} / ${shape.h}`,
        ...(shape.h > 300 ? { maxHeight: 'calc(100dvh - 6rem)' } : {}),
      }

  if (!asked || (!ad && quiet)) return null

  return (
    <aside
      className={cn('mx-auto w-full', fill && 'h-full', className)}
      aria-label="Advertisement"
    >
      <div
        className={cn('group relative mx-auto', fill && 'h-full')}
        style={fill ? undefined : { maxWidth: shape.w }}
      >
        {ad && picture ? (
          <>
            <button
              onClick={async () => {
                await recordAdClick(ad.id).catch(() => {})
                if (/^https?:\/\//i.test(ad.target_path)) {
                  window.open(ad.target_path, '_blank', 'noopener,noreferrer')
                } else {
                  navigate(ad.target_path)
                }
              }}
              style={frame}
              className="relative block w-full overflow-hidden rounded-xl border border-ink-line bg-ink-card transition-colors hover:border-brand/60"
            >
              <img
                src={picture}
                alt={ad.name}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />

              {/* The word sits on the ad rather than over the page, so it is
                  plain what it belongs to. */}
              {/* A picture can be any colour and so can the page, so the
                  mark is a soft dark pill with a light edge: it reads on
                  anything rather than becoming a black square on a light
                  page. */}
              <span className={cn('absolute left-1.5 top-1.5', overlayChip)}>Ad</span>
            </button>

            {/* Anybody who is shown an ad can say something about it. */}
            {profile && (
              <button
                onClick={() => setReporting(true)}
                aria-label={`Report the ad ${ad.name}`}
                title="Report this ad"
                className={cn(
                  'absolute right-1.5 top-1.5 h-6 w-6 text-[10px] opacity-0',
                  'focus-visible:opacity-100 group-hover:opacity-100 sm:opacity-70',
                  overlayButton,
                )}
              >
                <FontAwesomeIcon icon={faFlag} />
              </button>
            )}

            <ReportDialog
              open={reporting}
              onClose={() => setReporting(false)}
              targetType="ad"
              targetId={ad.id}
              targetName={`the ad "${ad.name}"`}
            />
          </>
        ) : (
          <Link
            to="/create/ads"
            style={frame}
            className="group mx-auto flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-line bg-ink-card/40 px-4 text-center transition-colors hover:border-brand/60 hover:bg-ink-hover"
          >
            <FontAwesomeIcon icon={faRectangleAd} className="text-base text-white/25" />
            <span className="text-xs font-bold text-white/55">This space is for an ad</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-link">
              Put your work here
              <FontAwesomeIcon icon={faArrowRight} className="text-[9px] transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        )}
      </div>
    </aside>
  )
}

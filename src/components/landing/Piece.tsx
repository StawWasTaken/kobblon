import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage, faMusic, faVideo, faFont, faCube, faShapes } from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { CurrencyMark } from '@/components/brand/Currency'
import { Verified, isVerified } from '@/components/brand/Verified'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { contentTag } from '@/components/create/AssetTile'
import { cn } from '@/lib/cn'
import type { AssetKind, MarketAsset } from '@/types/db'

const look: Record<AssetKind, { icon: IconDefinition; word: string; wash: string }> = {
  image: { icon: faImage, word: 'Decal', wash: 'from-brand/40' },
  audio: { icon: faMusic, word: 'Sound', wash: 'from-space/35' },
  video: { icon: faVideo, word: 'Video', wash: 'from-fuchsia-500/30' },
  font: { icon: faFont, word: 'Font', wash: 'from-amber-400/30' },
  mesh: { icon: faCube, word: 'Mesh', wash: 'from-cyan-400/30' },
  build: { icon: faShapes, word: 'Build', wash: 'from-emerald-400/30' },
}

const SAMPLE = 'Aa Bb Cc'

/**
 * A clip plays where it sits, with no sound and no controls, and only while
 * it is on screen: a page of videos all playing at once is a page nobody's
 * machine enjoys. The frame takes the shape of the clip itself rather than
 * cropping it into a box.
 */
function Clip({ src }: { src: string | null }) {
  const video = useRef<HTMLVideoElement>(null)
  const [ratio, setRatio] = useState<number | null>(null)
  const still = useReducedMotion()

  useEffect(() => {
    const node = video.current
    if (!node || still) return

    const watch = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) node.play().catch(() => {})
        else node.pause()
      },
      { rootMargin: '100px' },
    )
    watch.observe(node)
    return () => watch.disconnect()
  }, [src, still])

  return (
    <video
      ref={video}
      src={src ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      onLoadedMetadata={(e) => {
        const node = e.currentTarget
        if (node.videoWidth && node.videoHeight) setRatio(node.videoWidth / node.videoHeight)
      }}
      style={{ aspectRatio: ratio ?? 16 / 9 }}
      className="w-full rounded-[1.5rem] border border-white/10 bg-media object-cover"
    />
  )
}

/** A picture keeps its own shape, so nothing is cropped to fit a square. */
function Picture({ src, wash }: { src: string | null; wash: string }) {
  const [ratio, setRatio] = useState<number | null>(null)

  if (!src) {
    return (
      <span
        className={cn(
          'block aspect-[4/3] rounded-[1.5rem] border border-white/10 bg-gradient-to-br to-ink-card',
          wash,
        )}
      />
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onLoad={(e) => {
        const node = e.currentTarget
        if (node.naturalWidth && node.naturalHeight) {
          setRatio(node.naturalWidth / node.naturalHeight)
        }
      }}
      style={{ aspectRatio: ratio ?? 4 / 3 }}
      className="w-full select-none rounded-[1.5rem] border border-white/10 bg-media object-cover"
    />
  )
}

/** A font is only worth looking at in its own shapes. */
function Letters({ src, wash }: { src: string | null; wash: string }) {
  const [family, setFamily] = useState<string | null>(null)

  useEffect(() => {
    if (!src) return
    let live = true
    const name = `kob-piece-${Math.random().toString(36).slice(2, 8)}`
    const face = new FontFace(name, `url(${JSON.stringify(src)})`)

    face.load()
      .then((loaded) => {
        if (!live) return
        document.fonts.add(loaded)
        setFamily(name)
      })
      .catch(() => {})

    return () => {
      live = false
      document.fonts.delete(face)
    }
  }, [src])

  return (
    <span
      className={cn(
        'grid aspect-[4/3] place-items-center rounded-[1.5rem] border border-white/10 bg-gradient-to-br to-ink-card px-5',
        wash,
      )}
    >
      <span
        style={family ? { fontFamily: `"${family}", system-ui` } : undefined}
        className="block break-words text-center text-3xl leading-tight"
      >
        {SAMPLE}
      </span>
    </span>
  )
}

/**
 * One piece of work on the front page, previewed the way its kind deserves:
 * a clip plays, a picture keeps its shape, a sound is a square with its
 * cover, a font is set in itself, and a model shows whatever picture its
 * maker gave it.
 */
export function Piece({ item, width = 'w-[17rem] sm:w-[19rem]' }: {
  item: MarketAsset
  width?: string
}) {
  const kind = look[item.kind]
  const tag = contentTag(item.kind, item.content_id)

  // The thumbnail is the cover its maker uploaded; an image has itself.
  const cover = useSignedUrl(
    item.thumbnail_path ?? (item.kind === 'image' ? item.file_path : null),
  )
  // Only the kinds that are played or set need the file itself.
  const file = useSignedUrl(
    item.kind === 'video' || item.kind === 'font' ? item.file_path : null,
  )

  return (
    <Link to={tag ? `/create/${tag}` : '/create/marketplace'} className={cn('group block shrink-0', width)}>
      <span className="relative block transition-transform duration-300 group-hover:-translate-y-1.5">
        {item.kind === 'video' && <Clip src={file} />}

        {(item.kind === 'image' || item.kind === 'mesh') && (
          <Picture src={cover} wash={kind.wash} />
        )}

        {item.kind === 'font' && <Letters src={file} wash={kind.wash} />}

        {item.kind === 'audio' && (
          <span
            className={cn(
              'relative block aspect-square overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br to-ink-card',
              kind.wash,
            )}
          >
            {cover ? (
              <img
                src={cover}
                alt=""
                loading="lazy"
                draggable={false}
                className="h-full w-full select-none object-cover"
              />
            ) : (
              <span className="grid h-full w-full place-items-center">
                <FontAwesomeIcon icon={faMusic} className="text-5xl text-white/30" />
              </span>
            )}
          </span>
        )}

        <span className="pointer-events-none absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-ink/75 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide backdrop-blur">
          <FontAwesomeIcon icon={kind.icon} />
          {kind.word}
        </span>

        {tag && (
          <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-ink/75 px-3 py-1 font-display text-[11px] font-extrabold tabular-nums backdrop-blur">
            {tag}
          </span>
        )}
      </span>

      <span className="mt-4 flex items-baseline gap-3">
        <span className="min-w-0 flex-1 truncate font-display text-lg font-extrabold group-hover:text-link">
          {item.name}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-extrabold tabular-nums">
          {item.price ? <><CurrencyMark />{item.price}</> : <span className="text-space-bright">Free</span>}
        </span>
      </span>

      <span className="mt-0.5 flex items-center gap-1.5 text-sm text-white/45">
        {item.creator_display_name}
        {isVerified({ is_admin: item.creator_is_admin }) && <Verified className="text-[10px]" />}
      </span>
    </Link>
  )
}

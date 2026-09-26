import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faLock, faArrowDown, faCircleCheck, faCircleXmark, faClock, faHardDrive, faPlay,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { MediaPlayer } from '@/components/create/MediaPlayer'
import { contentTag, kindIcons, kindLabels } from '@/components/create/AssetTile'
import { useSignedUrl } from '@/hooks/useSignedUrl'
import { formatCount, timeAgo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ModerationStatus, OwnAsset } from '@/types/db'
import { overlayChip, overlayButton } from '@/lib/overlay'

/*
 * How an upload shows its face: its state, how big it is, and a preview that
 * is the thing itself rather than an icon standing in for it. Shared, because
 * the overview lists the latest few and the uploads page lists them all.
 */

export const statusLook: Record<ModerationStatus, {
  icon: IconDefinition
  label: string
  tone: string
  pip: string
}> = {
  approved: { icon: faCircleCheck, label: 'Live', tone: 'text-space-bright', pip: 'bg-space' },
  pending: { icon: faClock, label: 'In review', tone: 'text-amber-300', pip: 'bg-amber-300' },
  rejected: { icon: faCircleXmark, label: 'Turned down', tone: 'text-danger', pip: 'bg-danger' },
}

/** Bytes, said the way a person would say them. */
export function size(bytes: number) {
  if (!bytes) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

/* ------------------------------------------------------------- previewing */

/** A font, in its own shapes, small enough to sit in a card. */
function FontFace_({ src, name }: { src: string | null; name: string }) {
  const [family, setFamily] = useState<string | null>(null)

  useEffect(() => {
    if (!src) return
    let live = true
    const named = `kob-card-${Math.random().toString(36).slice(2, 8)}`
    const face = new FontFace(named, `url(${JSON.stringify(src)})`)
    face.load()
      .then((loaded) => { if (live) { document.fonts.add(loaded); setFamily(named) } })
      .catch(() => {})
    return () => { live = false; document.fonts.delete(face) }
  }, [src])

  return (
    <span
      className="flex h-full w-full flex-col items-center justify-center gap-1 px-3 text-center"
      style={family ? { fontFamily: family } : undefined}
    >
      <span className="text-3xl leading-none">Aa</span>
      <span className="truncate text-[11px] opacity-60">{name}</span>
    </span>
  )
}

/** What an upload looks like, whatever kind of thing it is. */
export function Preview({ item }: { item: OwnAsset }) {
  const url = useSignedUrl(
    item.kind === 'image' || item.kind === 'font' || item.kind === 'video' ? item.file_path : null,
  )

  if (item.kind === 'image') {
    return url
      ? <img src={url} alt="" className="h-full w-full object-cover" />
      : <span className="h-full w-full animate-pulse bg-ink-hover" />
  }

  if (item.kind === 'video') {
    return (
      <span className="relative block h-full w-full">
        {url && (
          <video
            src={url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        )}
        <span className="absolute inset-0 grid place-items-center bg-black/25">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-black/60 text-xs">
            <FontAwesomeIcon icon={faPlay} className="translate-x-px" />
          </span>
        </span>
      </span>
    )
  }

  if (item.kind === 'font') return <FontFace_ src={url} name={item.name} />

  // Sound and models: the mark for what it is, on the house colours.
  return (
    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-brand-deep to-brand/40">
      <FontAwesomeIcon icon={kindIcons[item.kind]} className="text-2xl text-white/70" />
    </span>
  )
}

/** One upload, as a card with its own face on it. */
export function UploadCard({ item }: { item: OwnAsset }) {
  const look = statusLook[item.status]
  const tag = contentTag(item.kind, item.content_id)
  const sound = useSignedUrl(item.kind === 'audio' ? item.file_path : null)

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-line bg-ink-card transition-colors hover:border-brand/60">
      <Link
        to={tag ? `/create/${tag}` : '/create/uploads'}
        className="relative block aspect-[4/3] overflow-hidden bg-media"
      >
        <Preview item={item} />

        <span className={cn(
          'absolute left-2 top-2 inline-flex items-center gap-1.5', overlayChip,
          'rounded-full px-2 py-1 font-display text-[10px] uppercase tracking-wide',
          look.tone,
        )}>
          <span className={cn('h-1.5 w-1.5 rounded-full', look.pip)} />
          {look.label}
        </span>

        {!item.is_public && (
          <span className={cn('absolute right-2 top-2 h-6 w-6 rounded-full text-[10px]', overlayButton)}>
            <FontAwesomeIcon icon={faLock} />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink-hover text-[11px] text-white/60">
            <FontAwesomeIcon icon={kindIcons[item.kind]} />
          </span>
          <div className="min-w-0 flex-1">
            <Link
              to={tag ? `/create/${tag}` : '/create/uploads'}
              className="block truncate text-sm font-bold hover:text-link"
            >
              {item.name}
            </Link>
            <p className="truncate text-[11px] text-muted">
              {kindLabels[item.kind]} · {timeAgo(item.created_at)}
              {item.uploaded_by && <> · by {item.uploaded_by}</>}
            </p>
          </div>
        </div>

        {item.kind === 'audio' && <MediaPlayer src={sound} kind="audio" className="text-white" />}

        {item.status === 'rejected' && item.review_note && (
          <p className="rounded-lg bg-danger/10 px-2 py-1.5 text-[11px] leading-relaxed text-danger">
            {item.review_note}
          </p>
        )}

        <div className="mt-auto flex items-center gap-3 pt-1 text-[11px] font-bold text-muted">
          <span className="font-mono text-white/45">{tag || 'No number yet'}</span>
          <span className="ml-auto inline-flex items-center gap-1">
            <FontAwesomeIcon icon={faHardDrive} />
            {size(item.byte_size)}
          </span>
          <span className="inline-flex items-center gap-1">
            <FontAwesomeIcon icon={faArrowDown} />
            {formatCount(item.download_count)}
          </span>
        </div>
      </div>
    </article>
  )
}

/** The same upload, in a line, for when there are hundreds of them. */
export function UploadLine({ item }: { item: OwnAsset }) {
  const look = statusLook[item.status]
  const tag = contentTag(item.kind, item.content_id)

  return (
    <li className="flex items-center gap-3 border-b border-ink-line/70 px-4 py-3 last:border-0 hover:bg-ink-hover/50">
      <span className="h-10 w-14 shrink-0 overflow-hidden rounded-lg bg-media">
        <Preview item={item} />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={tag ? `/create/${tag}` : '/create/uploads'}
          className="block truncate text-sm font-bold hover:text-link"
        >
          {item.name}
        </Link>
        <p className={cn('flex flex-wrap items-center gap-1.5 text-xs', look.tone)}>
          <FontAwesomeIcon icon={look.icon} />
          {look.label}
          <span className="text-muted">
            · {kindLabels[item.kind]} · {timeAgo(item.created_at)}
            {item.uploaded_by && <> · by {item.uploaded_by}</>}
          </span>
          {!item.is_public && (
            <span className="inline-flex items-center gap-1 text-muted">
              <FontAwesomeIcon icon={faLock} /> Unlisted
            </span>
          )}
        </p>
      </div>
      <span className="hidden text-xs text-muted sm:block">{size(item.byte_size)}</span>
      <span className="hidden font-mono text-xs text-muted sm:block">{tag}</span>
    </li>
  )
}

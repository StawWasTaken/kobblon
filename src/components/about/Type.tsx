import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The three pieces of type a band is allowed.
 *
 * An eyebrow, a heading and a lead, and nothing between them. The old
 * About pages had five sizes of heading between four pages because each
 * one picked its own, and the result is a side of a site where nothing
 * tells you what is a chapter and what is a note.
 *
 * The heading scales with the window rather than at a breakpoint, so the
 * line it sits on breaks in the same place on a laptop and on a desk
 * monitor instead of jumping a size at 640 pixels.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn(
      'text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-bright',
      className,
    )}>
      {children}
    </p>
  )
}

export function Title({ children, className, level = 2 }: {
  children: ReactNode
  className?: string
  /** 1 for the page's own name, 2 for a band. One 1 per page. */
  level?: 1 | 2
}) {
  const Tag = level === 1 ? 'h1' : 'h2'
  return (
    <Tag className={cn(
      'font-display font-extrabold leading-[0.95] tracking-tight',
      level === 1
        ? 'text-[clamp(2.5rem,5.2vw,4.25rem)]'
        : 'text-[clamp(1.9rem,3.6vw,3rem)]',
      className,
    )}>
      {children}
    </Tag>
  )
}

export function Lead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('max-w-2xl text-lg leading-relaxed text-white/55', className)}>
      {children}
    </p>
  )
}

/** Eyebrow, heading and lead in one call, which is how most bands open. */
export function BandHead({
  eyebrow, title, lead, centre = false, className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  centre?: boolean
  className?: string
}) {
  return (
    <div className={cn(centre && 'mx-auto max-w-3xl text-center', className)}>
      {eyebrow && <Eyebrow className="mb-4">{eyebrow}</Eyebrow>}
      <Title>{title}</Title>
      {lead && <Lead className={cn('mt-5', centre && 'mx-auto')}>{lead}</Lead>}
    </div>
  )
}

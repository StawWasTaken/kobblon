import { useHeadshot } from '@/hooks/useHeadshot'
import { cn } from '@/lib/cn'

const sizes = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
  xl: 'h-24 w-24 text-3xl',
}

export type AvatarSize = keyof typeof sizes

export function Avatar({
  src,
  name,
  personId,
  changedAt,
  size = 'md',
  className,
  style,
}: {
  src?: string | null
  name: string
  /**
   * Whose face this is.
   *
   * With it and nothing stored, their avatar is drawn and appears here -
   * which is every new account and every guest, who have a dressed avatar
   * and no picture of it. Without it, initials, which is still right for
   * the places that have a name and no person behind it.
   */
  personId?: string | null
  /**
   * When that person last changed their avatar. A stored picture older than
   * this is of who they used to be, so it is redrawn instead of shown.
   */
  changedAt?: string | null
  size?: AvatarSize
  className?: string
  style?: React.CSSProperties
}) {
  const initials = name.slice(0, 2).toUpperCase()
  const picture = useHeadshot(personId, src, changedAt)
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-brand-deep font-bold uppercase text-white/90',
        sizes[size],
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      {picture ? <img src={picture} alt="" className="h-full w-full object-cover" loading="lazy" /> : initials}
    </span>
  )
}

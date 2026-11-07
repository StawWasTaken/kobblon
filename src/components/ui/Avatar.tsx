import { Picture } from '@/components/brand/Picture'
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
  unavailable,
}: {
  src?: string | null
  name: string
  /**
   * Whose face this is.
   *
   * With it and nothing stored, their avatar is drawn and appears here -
   * which is every new account and every guest, who have a dressed avatar
   * and no picture of it. Without it there is nothing to draw, and what
   * shows is the same mark every other picture on the site shows.
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
  /**
   * Nobody is behind this one any more, so nothing is drawn for it.
   *
   * Not an error state dressed up: the account is gone or going, and the
   * picture is a shot of an avatar that no longer exists. It gets the mark
   * with a reason on it rather than a different drawing of its own.
   */
  unavailable?: boolean
}) {
  const picture = useHeadshot(unavailable ? null : personId, unavailable ? null : src, changedAt)
  /*
   * One answer for a picture that is not there, and it is Staw's mark.
   *
   * It was three answers: initials where there was a name, a Font Awesome
   * person where the account had gone, and whatever each caller drew for
   * itself. "use it for everything that doesnt load, instead of a random
   * svg icon like for user icon etc" - so the name is kept for the label
   * and the drawing is the one the rest of the site uses.
   */
  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10',
        sizes[size],
        className,
      )}
      style={style}
      aria-hidden="true"
    >
      <Picture
        src={picture}
        why={unavailable ? 'Nobody is here any more' : undefined}
        className="h-full w-full"
        alt={name}
      />
    </span>
  )
}

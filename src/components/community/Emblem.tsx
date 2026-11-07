import { Picture } from '@/components/brand/Picture'
import { cn } from '@/lib/cn'

/**
 * A Community's emblem.
 *
 * Whatever is behind it shows through where the picture is see through: an
 * emblem drawn with a transparent background was being sat on a blue square,
 * which is not what its maker drew. A Community without one, or with one
 * that will not load, gets the same mark every other picture on the site
 * gets rather than its initials.
 */
export function Emblem({
  src, name, className, rounded = 'rounded-lg',
}: {
  src?: string | null
  name: string
  className?: string
  rounded?: string
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden font-display font-extrabold',
        rounded,
        className,
      )}
    >
      <Picture src={src} alt={name} className={cn('h-full w-full', rounded)} />
    </span>
  )
}

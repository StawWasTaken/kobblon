import { cn } from '@/lib/cn'
import { asset } from '@/lib/asset'

/**
 * Kobby shows up for moments, not for decoration on every screen: empty
 * states, notifications, errors, the odd celebration.
 */
export const kobbyArt = {
  default: asset('/brand/kobby.png'),
  notification: asset('/brand/kobby_notification.png'),
  construction: asset('/brand/under_construction.png'),
  crown: asset('/brand/kobby_crown.png'),
  /** Kobby in sunglasses, for Style. */
  style: asset('/brand/kobby_sunglasses.png'),
  emptyBox: asset('/brand/kobby_empty_box.png'),
  noResults: asset('/brand/kobby_no_results.png'),
} as const

export type KobbyMood = keyof typeof kobbyArt

const sizes = { sm: 'h-20', md: 'h-32', lg: 'h-44', xl: 'h-56' }

export function Kobby({
  mood = 'default',
  size = 'md',
  bob = true,
  className,
}: {
  mood?: KobbyMood
  size?: keyof typeof sizes
  bob?: boolean
  className?: string
}) {
  return (
    <img
      src={kobbyArt[mood]}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={cn('w-auto select-none object-contain', sizes[size], bob && 'animate-bob', className)}
    />
  )
}

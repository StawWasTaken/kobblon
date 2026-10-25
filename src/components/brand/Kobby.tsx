import { cn } from '@/lib/cn'
import { asset } from '@/lib/asset'

/**
 * The drawings that stand in for a moment: an empty shelf, a search that
 * found nothing, a page that is not built yet, a panel with no post in it.
 * Not decoration on every screen - these are for the moments a page has
 * nothing to show and has to say so with something other than a sentence.
 *
 * Staw drew this set and it replaces the old one outright. They are not
 * Kobby in different hats any more, which is the part worth knowing: each
 * one is a picture of the situation rather than a mascot reacting to it,
 * and one of them has no character in it at all.
 *
 * The keys are the situations, not the pictures, which is why they did not
 * change when the drawings did - forty call sites ask for `noResults` and
 * none of them had to know that it stopped being a shrug and became a
 * lighthouse.
 */
export const kobbyArt = {
  /** Nothing here yet: a stand with one brick on it. */
  emptyBox: asset('/mascot/brix.png'),
  /** Looked and did not find it. Staw: "no result/looking for some". */
  noResults: asset('/mascot/lighthouse.png'),
  /** Not built yet, being worked on, or broken. */
  construction: asset('/mascot/worker.png'),
  /** Something came in, or nothing did. */
  notification: asset('/mascot/notification.png'),
  /** The Catalog's own, for the shelves rather than for a search. */
  style: asset('/mascot/shades.png'),
  /*
   * Kobby's own face, which is not one of the five and is not an empty
   * state: it is the 28-pixel mark beside "Ask Kobby" in the staff panel,
   * where it names the auto-admin rather than filling a hole in a page.
   * Staw replaced the situation drawings; this is a label.
   */
  default: asset('/brand/kobby.png'),
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

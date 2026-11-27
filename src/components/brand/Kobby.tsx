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
  /**
   * A Brick floating over its stand, like a prize.
   *
   * Staw, correcting the first pass at this: "the mood isnt emptybox
   * bruh". He is right - it is not a hole in a page, it is the thing you
   * are playing for, so it belongs where Brix are earned and ranked and
   * nowhere else. `emptyBox` is gone rather than renamed: the old drawing
   * it named is not in his new sheet at all, and a page with nothing on
   * it has looked and found nothing, which is the lighthouse.
   */
  brix: asset('/mascot/brix.png'),
  /** Looked and did not find it. Staw: "no result/looking for some". */
  noResults: asset('/mascot/lighthouse_no_results.png'),
  /** Not built yet, being worked on, or broken. */
  construction: asset('/mascot/construction_worker.png'),
  /** Something came in, or nothing did. */
  notification: asset('/mascot/notification.png'),
  /** The Catalog's own, for the shelves rather than for a search. */
  style: asset('/mascot/sunglasses.png'),
  /*
   * Waving. The one in this set that is not a hole in a page: it is for
   * the places where there is nobody yet and the answer is to go and meet
   * somebody, rather than places where something was looked for and not
   * found. The lighthouse says "it is not here"; this says "say hello".
   *
   * Staw drew it and it was briefly mistaken for a reference for the wave
   * emote, which it is not - that is a pose in `k6.glb` and this is a
   * picture.
   */
  wave: asset('/mascot/wave.png'),
  /*
   * The guest with the hammer, which is not an empty state and is not the
   * worker: the worker stands for a thing that is not finished, and this
   * one is a Kobblonian who builds, standing beside what is being
   * advertised. Staw counts it in the set and it was already drawn, so it
   * keeps the two placements it was made for - the Download hero and the
   * corner of the Workspace banner. Merging the two into one drawing last
   * round was wrong.
   */
  building: asset('/mascot/under_construction.png'),
  /*
   * The default avatar, drawn: who you are the minute you join with an
   * ordinary account, arms out, nothing worn yet.
   *
   * Staw drew it for the pages that explain Kobblon to somebody who has
   * not got one - What is Kobblon, the landing page - and it is in the
   * set now so those pages can reach for it when they are rebuilt. It is
   * not an empty state and must not be used as one: a hole in a page is
   * the lighthouse, and this is a person.
   */
  newbie: asset('/mascot/newbie.png'),
  /*
   * Kobby himself, who is a Kobbot now.
   *
   * Staw: "kobby must now not be the old ugly image of kobby but the new
   * cool gif of a kobbot model 'kobbot1' that we'll name kobby". So the
   * blue blob at `/brand/kobby.png` is retired - the file stays where it
   * is, nothing draws it any more - and this is his idle: a white robot
   * with the K on his chest, 250x480, two and a half seconds, looping.
   *
   * The loop is right here where a logo reveal's was not: an idle is a
   * character breathing, and a character who stops breathing after one
   * go is a character who has died in the corner of the page.
   *
   * He is not one of the five situation drawings and is not an empty
   * state: this is a label - the mark beside "Ask Kobby" - and a hole in
   * a page is still the lighthouse.
   */
  default: asset('/mascot/kobby.gif'),
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

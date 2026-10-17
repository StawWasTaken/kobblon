import { asset } from '@/lib/asset'

/**
 * The appearances Kobblon can wear, in one place.
 *
 * Staw: "its still always white or our black background colour but the
 * sidebar & logomark/wordmark will change". So an appearance is not a theme
 * in the usual sense and it is deliberately not the dark/light mode: the
 * mode is about the room somebody is sitting in and stays in the browser,
 * an appearance is about the account and follows them everywhere. Both
 * apply at once, which is what his own art says - he drew a halloween
 * backdrop for the dark interface and a second one for the light.
 *
 * What an appearance actually changes:
 *
 *   the chrome      the bar and the rail, moved from blue into the
 *                   season's colour and nothing else moved with it. The
 *                   numbers are in `design/tokens.css`.
 *   the marks       the wordmark in the bar and the logomark beside it
 *   the backdrop    what an avatar stands in, Staw's own photographs
 *
 * What it never changes: the buttons. "for the buttons, we gonna keep the
 * blue & green & red, the appearances dont change that much" - and they are
 * the one part of this site that means something by its colour, so a green
 * that is sometimes orange is a yes that is sometimes a maybe.
 *
 * The list here is the *display* side of it. What somebody may wear is the
 * database's answer and nothing in this file decides it.
 */
export type Appearance = 'default' | 'halloween' | 'christmas'

export const APPEARANCES: Appearance[] = ['default', 'halloween', 'christmas']

export type AppearanceLook = {
  id: Appearance
  name: string
  /** One line under the name in Settings, and on the card that offers it. */
  note: string
  /** The 3D wordmark, the one the card leads with. */
  wordmark: string
  logomark: string
  /** When it is given away, in words. Empty for the one everybody has. */
  when: string
  /** The falling thing, if it has one. */
  weather?: 'snow' | 'leaves'
}

export const LOOKS: Record<Appearance, AppearanceLook> = {
  default: {
    id: 'default',
    name: 'Kobblon',
    note: 'The blue one. Everybody has this.',
    wordmark: '/brand/wordmark2.png',
    logomark: '/brand/logomark.png',
    when: '',
  },
  halloween: {
    id: 'halloween',
    name: 'Halloween',
    note: 'The bar and the rail in pumpkin orange, and leaves on some pages.',
    wordmark: '/brand/wordmark-halloween.png',
    logomark: '/brand/logomark-halloween.png',
    when: 'Given away every October.',
    weather: 'leaves',
  },
  christmas: {
    id: 'christmas',
    name: 'Christmas',
    note: 'Deep green chrome, and snow on some pages.',
    wordmark: '/brand/wordmark-christmas.png',
    logomark: '/brand/logomark-christmas.png',
    when: 'Given away from the middle of November to the end of the year.',
    weather: 'snow',
  },
}

export function lookOf(which: string | null | undefined): AppearanceLook {
  return LOOKS[(which ?? 'default') as Appearance] ?? LOOKS.default
}

/** The artwork, ready to put in a `src`. */
export function marksOf(which: string | null | undefined) {
  const look = lookOf(which)
  return { wordmark: asset(look.wordmark), logomark: asset(look.logomark) }
}

/**
 * Whether an appearance is one of the seasonal ones.
 *
 * Used for the wording rather than for permission: what somebody may wear
 * is `my_appearances()` and nothing else.
 */
export const isSeasonal = (which: string) => which !== 'default'

/**
 * The one thing Kobblon is running right now, for the band on Home.
 *
 * This used to be a constant in this file, with a comment saying: "When
 * there are several at once, or somebody other than Staw sets them, it
 * becomes a table and this file becomes the fallback." Somebody other than
 * Staw sets them now - Staw: "make it so superadmins can make their own in
 * the staff command and make it if it appears or not" - so 0321 made the
 * table and the constant is gone.
 *
 * It is gone rather than kept as a fallback, which is the part worth
 * saying out loud: a hardcoded event that comes back the moment somebody
 * switches theirs off is the switch not working, and the switch is the
 * thing that was asked for. The homepage draws what the table says and
 * nothing when it says nothing.
 *
 * What is left here is the half that is the website's rather than the
 * database's: the shape of a row, and what each art theme is made of.
 */

/** What is being given away, biggest first. Drawn as Brix chips. */
export type EventPrize = { place: string; brix: number }

export type PlatformEvent = {
  id: string
  /** The small word over the name: "Avatar contest", "Event". */
  tag: string
  /** What it is called, as the band's heading. */
  name: string
  /** One line about it. */
  blurb: string
  /** Where the band goes. A path on this site or an https address. */
  link: string
  /** What the button says. */
  action: string
  /** Which marks and which colour the band wears, where nothing of its
   * own has been uploaded. */
  theme: EventTheme
  /**
   * A picture of its own, in place of the theme's mark - the big art
   * bleeding out of the top of the band. Null is the theme's.
   */
  art_url: string | null
  /**
   * A picture behind the whole band, under the lights and the words. Null
   * is the theme's flat colour and its glow.
   */
  back_url: string | null
  /**
   * A colour under everything, as `#rrggbb`, where the theme's own is not
   * wanted. Ignored where there is a background picture, because the
   * picture is already covering it. Null is the theme's.
   */
  back_colour: string | null
  /**
   * The small print in the corner the prizes would be in.
   *
   * Staw: "the event header isnt always for prize winnings yk". So the
   * corner holds whatever a band that is not a contest wants to say there -
   * "Until the 24th", "Everybody gets one" - and holds the prizes instead
   * when there are prizes, which is the one of the two that has to win: a
   * line of text beside three Brix chips is two kinds of small print in
   * one corner.
   */
  note: string
  /**
   * Empty where there is nothing to win, and the row of chips is then not
   * drawn at all - three empty chips under an event with no prize is
   * furniture.
   */
  prizes: EventPrize[]
  /**
   * The day after the last day, as `YYYY-MM-DD`. The band is gone from
   * then on, and `event_showing()` is what decides that rather than the
   * page - a band that outlives the thing it is about is worse than no
   * band, and the page is the one place that cannot be trusted to know
   * what day it is. Null means nobody has set an end.
   */
  until: string | null
}

export type EventTheme = 'kobblon' | 'halloween' | 'christmas'

/**
 * The three sets of marks this build ships, and the light each one wears.
 *
 * A named theme rather than a field somebody types a picture's address
 * into, because a text field for a path is a field that can name a picture
 * which is not there, and the band would then draw a broken image across
 * the top of the homepage. Three real sets, each with art that exists in
 * `public/brand`.
 *
 * `glow` is the wide light behind the mark, `edge` and `hover` the band's
 * own border, `back` the colour under everything. The button stays blue in
 * all three: blue is Kobblon and is what every other thing to press on
 * this site is.
 */
export const EVENT_THEMES: Record<EventTheme, {
  label: string
  /** The big mark, bleeding out of the top of the band. */
  mark: string
  /** The event's own wordmark, in the opposite corner. Null for Kobblon's
   * own band, where the mark is already the wordmark's family. */
  wordmark: string | null
  back: string
  /** The same colour as the class above, as a value rather than a class -
   * for the colour picker in the staff console, which has to start
   * somewhere, and for anything that cannot use Tailwind. */
  colour: string
  edge: string
  glow: string
  /** The light the mark itself throws. Halloween's is orange, and losing
   * it is the difference between a mark on a background and a mark lit
   * from behind - which is the whole trick the band is doing. */
  halo: string
}> = {
  kobblon: {
    label: 'Kobblon',
    mark: '/brand/logomark.png',
    wordmark: '/brand/wordmark.png',
    back: 'bg-[#05101f]',
    colour: '#05101f',
    edge: 'border-brand/25 hover:border-brand/50',
    glow: 'bg-[radial-gradient(85%_150%_at_66%_40%,rgba(37,99,235,0.6),rgba(12,46,110,0.45)_42%,rgba(3,10,22,0.9)_78%)]',
    halo: 'drop-shadow-[0_0_60px_rgba(59,130,246,0.45)]',
  },
  halloween: {
    label: 'Halloween',
    mark: '/brand/logomark-halloween.png',
    wordmark: '/brand/wordmark-halloween.png',
    back: 'bg-[#150b05]',
    colour: '#150b05',
    edge: 'border-orange-400/20 hover:border-orange-400/45',
    glow: 'bg-[radial-gradient(85%_150%_at_66%_40%,rgba(249,115,22,0.6),rgba(130,40,6,0.45)_42%,rgba(20,8,3,0.9)_78%)]',
    halo: 'drop-shadow-[0_0_60px_rgba(249,115,22,0.45)]',
  },
  christmas: {
    label: 'Christmas',
    mark: '/brand/logomark-christmas.png',
    wordmark: '/brand/wordmark-christmas.png',
    back: 'bg-[#07130d]',
    colour: '#07130d',
    edge: 'border-emerald-400/20 hover:border-emerald-400/45',
    glow: 'bg-[radial-gradient(85%_150%_at_66%_40%,rgba(16,185,129,0.55),rgba(6,78,59,0.45)_42%,rgba(3,18,12,0.9)_78%)]',
    halo: 'drop-shadow-[0_0_60px_rgba(16,185,129,0.45)]',
  },
}

/** The theme a row names, or Kobblon's if it names one we do not have. */
export function themeOf(name: string | null | undefined) {
  return EVENT_THEMES[(name ?? 'kobblon') as EventTheme] ?? EVENT_THEMES.kobblon
}

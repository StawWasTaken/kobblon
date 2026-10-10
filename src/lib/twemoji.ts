/*
 * Emoji drawn as Twemoji, so they look the same on every machine.
 *
 * Staw wants one set of emoji across Kobblon. An emoji left to the operating
 * system is a different picture on Windows, on a Mac, on Android and on two
 * Androids - which is fine for a message to a friend and not fine for a
 * platform where somebody puts one in a World's name and somebody else sees
 * a box.
 *
 * The pictures are Kobblon's own, under `public/twemoji`, rather than a
 * content network's. That costs 7.8MB and 3,720 files in the repository,
 * which is not nothing and is said here rather than discovered later. What
 * it buys: nothing on a page depends on a third party staying up, and the
 * Launcher can point `TWEMOJI_AT` at a folder it ships and work with no
 * network at all. Twemoji is CC-BY 4.0; `public/twemoji/LICENSE` travels
 * with the files.
 */

/** Where the pictures are. An application with its own copy reassigns it. */
export const TWEMOJI = {
  at: '/twemoji',
  /** The licence asks for attribution, and this is where it is given. */
  credit: 'Twemoji by Twitter, CC-BY 4.0',
}

const ZWJ = 0x200d
const VARIATION = 0xfe0f

/*
 * One emoji, in all the shapes one comes in.
 *
 * Built by hand rather than with `\p{RGI_Emoji}` because that needs the `v`
 * flag, which is new enough that an older browser throws at parse time -
 * and a regular expression that throws while the module loads takes the
 * whole site down rather than one emoji.
 *
 * The four alternatives, and all four are load-bearing:
 *
 *   * two regional indicators - a flag
 *   * the tag sequence - England, Scotland and Wales, which are a flag
 *     followed by invisible letters
 *   * a keycap: a digit, a hash or a star, then U+20E3
 *   * a pictograph, with a skin tone or a variation selector after it, any
 *     number of times joined by U+200D - which is what makes a family one
 *     emoji rather than four people
 *
 * `\p{Emoji_Modifier}` is named separately because a skin tone is **not**
 * `Extended_Pictographic`, which is the sort of thing that looks right in
 * every test written with a yellow hand.
 */
const ONE = String.raw`\p{RI}\p{RI}`
  + String.raw`|\u{1F3F4}[\u{E0060}-\u{E007F}]+`
  + String.raw`|[0-9#*]️?⃣`
  + String.raw`|\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️)*`
  + String.raw`(?:‍\p{Extended_Pictographic}(?:\p{Emoji_Modifier}|️)*)*`

/** A fresh one each time: a global regular expression carries `lastIndex`. */
export const emojiFinder = () => new RegExp(`(${ONE})`, 'gu')

/**
 * The file name Twemoji gives a sequence.
 *
 * The one rule that is not obvious: the variation selector is dropped,
 * **except** when the sequence is joined - Twemoji keeps it there and not
 * anywhere else. Getting this backwards gives a 404 for every emoji with a
 * person in it, which is most of the ones people use.
 */
export function twemojiName(emoji: string): string {
  const codes = [...emoji].map((c) => c.codePointAt(0)!)
  const joined = codes.includes(ZWJ)
  return codes
    .filter((code) => joined || code !== VARIATION)
    .map((code) => code.toString(16))
    .join('-')
}

/** Where its picture is. */
export const twemojiUrl = (emoji: string) => `${TWEMOJI.at}/${twemojiName(emoji)}.svg`

/**
 * A line of text cut into its words and its emoji, in order.
 *
 * Returned rather than rendered so that the engine, the Launcher and the
 * website can each draw the pieces the way their own surface draws them -
 * a DOM node here, a texture there - without three copies of the rules
 * above drifting apart.
 */
export type Piece =
  | { text: string; emoji?: undefined }
  | { emoji: string; url: string; text?: undefined }

export function cutEmoji(text: string): Piece[] {
  const out: Piece[] = []
  const finder = emojiFinder()
  let at = 0
  let found: RegExpExecArray | null

  while ((found = finder.exec(text))) {
    if (found.index > at) out.push({ text: text.slice(at, found.index) })
    out.push({ emoji: found[0], url: twemojiUrl(found[0]) })
    at = found.index + found[0].length
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}

/** Whether a line has one at all, so a caller can skip the work. */
export const hasEmoji = (text: string) => emojiFinder().test(text)

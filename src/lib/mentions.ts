/*
 * `@somebody`, and the colour their name is written in.
 *
 * Both of these came over from the in-World chat the other session built,
 * because a mention has to look the same in a World as it does in a dock -
 * Staw asked for the dock to carry what the World chat carries, and a pill
 * drawn two ways is two features.
 *
 * The rule that keeps it honest: **only real people light up.** The matcher
 * is given who is in the conversation, and an `@word` that is nobody stays
 * the characters somebody typed. A pill on a name that does not exist is a
 * link to nowhere wearing Kobblon blue.
 */

/** A mention is an `@` and a username, which is what usernames are made of. */
const WORD = /@([a-z0-9_]{2,24})/gi

export type Bit =
  | { text: string }
  /** A real person. `at` is the username as typed, without the `@`. */
  | { text: string; at: string; me?: boolean }

/**
 * A piece of text, split into plain stretches and the mentions in it.
 *
 * `known` answers whether a username belongs to somebody in this
 * conversation, lowercased; `mine` is your own username, because your own
 * name is the one worth finding in a wall of text and it is drawn stronger.
 */
export function mentionBits(
  text: string,
  known: (username: string) => boolean,
  mine?: string | null,
): Bit[] {
  const bits: Bit[] = []
  let last = 0
  WORD.lastIndex = 0

  for (let hit = WORD.exec(text); hit; hit = WORD.exec(text)) {
    const name = hit[1].toLowerCase()
    if (!known(name)) continue
    if (hit.index > last) bits.push({ text: text.slice(last, hit.index) })
    bits.push({ text: hit[0], at: hit[1], me: Boolean(mine) && name === mine?.toLowerCase() })
    last = hit.index + hit[0].length
  }

  if (last < text.length) bits.push({ text: text.slice(last) })
  return bits
}

/*
 * The colours a display name can be written in.
 *
 * Twelve, all of them readable on a dark panel and none of them Kobblon
 * blue or Space green - those two mean things on this platform and a name
 * that happens to land on one is a name that looks like a status.
 */
const COLOURS = [
  '#7FB2FF', '#FFB86B', '#FF8DA3', '#9BE8C1', '#C7A5FF', '#FFD166',
  '#6FD3E8', '#F08CC8', '#A8D672', '#FF9F7A', '#8FA7FF', '#E8C87F',
]

/**
 * Which colour a person's name is written in.
 *
 * Taken from the user id wherever there is one, so the colour survives a
 * rename and two people with one display name do not end up sharing one.
 * The display name is only the fallback, for a line with no id behind it.
 */
export function colourOf(id?: string | null, name?: string | null): string {
  const seed = id || name || ''
  let sum = 0
  for (let at = 0; at < seed.length; at += 1) sum = (sum * 31 + seed.charCodeAt(at)) % 100003
  return COLOURS[sum % COLOURS.length]
}

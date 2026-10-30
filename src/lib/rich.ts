/*
 * What somebody typed, as runs rather than as markup.
 *
 * Chat carries text. A message that arrives as `**hi**` has to be drawn
 * bold, and the one thing that must never happen on the way there is
 * turning it into HTML and handing that to the browser - a platform where
 * anybody can type a message is a platform where somebody will type a tag.
 * So nothing here builds markup. `runsOf` returns a list of pieces and
 * which marks each piece wears, and the component that draws them puts
 * them in real elements.
 *
 * The marks are Discord's, because that is what Staw asked for and what
 * everybody already knows:
 *
 *   **bold**   *italic*   __underline__   ~~strike~~
 *
 * They nest, in any order.
 *
 * The one rule that is not obvious and matters more than the rest: **an
 * opener followed by a space is not an opener.** Without it `2 * 3 * 4`
 * becomes "2 3 4" with a italic three in the middle, and somebody doing
 * arithmetic in chat finds their sum rewritten. The same check at the
 * closing end: a mark with a space in front of it does not close anything.
 */

export type Mark = 'bold' | 'italic' | 'underline' | 'strike'

export type Run = {
  text: string
  marks: Mark[]
}

/** The openers, longest first: `**` must be tried before `*`. */
const MARKS: { token: string; mark: Mark }[] = [
  { token: '**', mark: 'bold' },
  { token: '__', mark: 'underline' },
  { token: '~~', mark: 'strike' },
  { token: '*', mark: 'italic' },
]

/** Whether a token at this point opens something: it needs a non-space after. */
const opens = (text: string, at: number, token: string) => {
  const after = text[at + token.length]
  return after !== undefined && after !== ' ' && after !== '\n'
}

/** And a closer needs a non-space in front of it. */
const closes = (text: string, at: number) => {
  const before = text[at - 1]
  return before !== undefined && before !== ' ' && before !== '\n'
}

/**
 * The message, split into pieces that each wear a set of marks.
 *
 * A mark that is never closed is not a mark: the token is left in the text
 * exactly as it was typed, because somebody who wrote `2 ** 3` meant that.
 */
export function runsOf(input: string): Run[] {
  const runs: Run[] = []
  const open: { token: string; mark: Mark; at: number }[] = []
  let held = ''
  let at = 0

  const flush = () => {
    if (!held) return
    runs.push({ text: held, marks: open.map((one) => one.mark) })
    held = ''
  }

  while (at < input.length) {
    /*
     * Closing the innermost mark is tried before anything else, and it is
     * tried against *its own* token rather than against the longest one
     * that matches here. `***both***` is why: at the end, the longest
     * match is `**`, but what is open innermost is `*`, and closing them
     * in that order is the only reading that leaves no asterisks behind.
     */
    const top = open[open.length - 1]
    if (top && input.startsWith(top.token, at) && closes(input, at)) {
      flush()
      open.pop()
      at += top.token.length
      continue
    }

    const found = MARKS.find((one) => input.startsWith(one.token, at))

    if (found) {
      const shut = open.some((one) => one.token === found.token)

      /*
       * Only opened when there is a closer for it later on. Looking ahead
       * is what keeps an unclosed `**` as two asterisks rather than as a
       * bold half of the message - and it is cheap, because a chat message
       * is at most two thousand characters.
       */
      if (!shut && opens(input, at, found.token)
          && hasCloser(input, at + found.token.length, found.token)) {
        flush()
        open.push({ token: found.token, mark: found.mark, at })
        at += found.token.length
        continue
      }
    }

    held += input[at]
    at += 1
  }

  flush()

  /* Nothing is ever left open: a token only opens when `hasCloser` has
     already found its closer, so an unclosed one stayed in the text. */
  return runs.filter((run) => run.text.length > 0)
}

/** Whether this token turns up again, with something in front of it. */
function hasCloser(input: string, from: number, token: string) {
  let at = from
  while (at < input.length) {
    const next = input.indexOf(token, at)
    if (next < 0) return false
    if (closes(input, next)) return true
    at = next + token.length
  }
  return false
}

/**
 * Put a mark around the selection, or take it off again.
 *
 * Returns the whole new text and where the selection should sit
 * afterwards, so the box can put the cursor back around the same words.
 * Nothing is selected and nothing happens - a mark with no words in it is
 * two tokens somebody then has to type between.
 */
export function wrap(
  text: string, from: number, to: number, mark: Mark,
): { text: string; from: number; to: number } {
  const token = MARKS.find((one) => one.mark === mark)?.token ?? '*'
  if (from === to) return { text, from, to }

  const before = text.slice(0, from)
  const middle = text.slice(from, to)
  const after = text.slice(to)

  // Already wearing it, inside the selection or just outside it: take it off.
  if (middle.startsWith(token) && middle.endsWith(token)
      && middle.length > token.length * 2) {
    const bare = middle.slice(token.length, middle.length - token.length)
    return { text: before + bare + after, from, to: from + bare.length }
  }
  if (before.endsWith(token) && after.startsWith(token)) {
    const cut = before.slice(0, before.length - token.length)
    return {
      text: cut + middle + after.slice(token.length),
      from: cut.length,
      to: cut.length + middle.length,
    }
  }

  const put = token + middle + token
  return { text: before + put + after, from, to: from + put.length }
}

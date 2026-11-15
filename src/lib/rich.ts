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
  /**
   * This run is a picture drawn where the text sits.
   *
   * The applications session asked for it in their last round and the
   * reason is the one this repository runs on: their `ChatBox` was six of
   * these functions written a second time, and the only thing it had that
   * this did not was an inline picture - a named picture or a GIF drawn in
   * the box being typed in rather than becoming one after sending. One run
   * type that can be a picture, and six hundred lines of theirs go.
   *
   * `text` is still exactly what was typed - `:plunk-smug:` and not an
   * empty string - so the runs still concatenate back to the writing and
   * every offset the caret counts is still counted over it. A drawer that
   * does not know about pictures draws the token, which is what it was
   * before.
   */
  picture?: { url: string; alt: string }
  /**
   * This run is a delimiter rather than words.
   *
   * Only `writingRunsOf` ever sets it. A sent message does not carry its
   * asterisks, but the box somebody is typing in does - Staw: "'*text*'
   * will show the 'text' in italic, while keeping the '*' on each side" -
   * and they are drawn dimmer than the words they are marking.
   */
  faint?: boolean
}

/**
 * What counts as a picture, asked of the text at a point in it.
 *
 * A function rather than a list of shapes, because this file knows nothing
 * about stickers or Klipy and should not: the website hands in one that
 * reads `pictures_by_name`, and an application hands in its own. It
 * answers how many characters the picture is written in, so the scan can
 * step over exactly that much.
 */
export type PictureAt = (
  input: string,
  at: number,
) => { length: number; url: string; alt: string } | null

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
export function runsOf(input: string, picture?: PictureAt): Run[] {
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
     * Pictures first, and before the marks: a token is a single thing, so
     * nothing inside it opens or closes anything. It still wears whatever
     * is open around it, because a picture inside a bold sentence is in
     * the bold sentence.
     */
    const drawn = picture?.(input, at)
    if (drawn && drawn.length > 0) {
      flush()
      runs.push({
        text: input.slice(at, at + drawn.length),
        marks: open.map((one) => one.mark),
        picture: { url: drawn.url, alt: drawn.alt },
      })
      at += drawn.length
      continue
    }

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

/* ------------------------------------------------- the box somebody types in */

/**
 * The same reading as `runsOf`, with the delimiters left in.
 *
 * The runs concatenate back to exactly what was typed, and that is the
 * whole point: the box is the message with weight on rather than a preview
 * of it, so every offset the caret counts is still counted over the
 * writing. Each delimiter is its own run, wearing the mark it opens or
 * closes and flagged `faint`.
 *
 * The other session asked for this one and wrote theirs first; ours reads
 * the same way so that a message typed in a World and a message typed in a
 * dock are the same message. `runsOf` and `wrap` are untouched.
 */
export function writingRunsOf(input: string, picture?: PictureAt): Run[] {
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
    const drawn = picture?.(input, at)
    if (drawn && drawn.length > 0) {
      flush()
      runs.push({
        text: input.slice(at, at + drawn.length),
        marks: open.map((one) => one.mark),
        picture: { url: drawn.url, alt: drawn.alt },
      })
      at += drawn.length
      continue
    }

    const top = open[open.length - 1]
    if (top && input.startsWith(top.token, at) && closes(input, at)) {
      flush()
      /* Written before the pop, so the closing token wears the mark it is
         closing - a dim asterisk inside the italic, not after it. */
      runs.push({ text: top.token, marks: open.map((one) => one.mark), faint: true })
      open.pop()
      at += top.token.length
      continue
    }

    const found = MARKS.find((one) => input.startsWith(one.token, at))

    if (found) {
      const shut = open.some((one) => one.token === found.token)
      if (!shut && opens(input, at, found.token)
          && hasCloser(input, at + found.token.length, found.token)) {
        flush()
        open.push({ token: found.token, mark: found.mark, at })
        runs.push({ text: found.token, marks: open.map((one) => one.mark), faint: true })
        at += found.token.length
        continue
      }
    }

    held += input[at]
    at += 1
  }

  flush()
  return runs.filter((run) => run.text.length > 0)
}

/**
 * The run sequence without the lengths.
 *
 * The box rebuilds its own insides only when it has to, and "the weight
 * changed" is one of the two reasons it has to. The lengths are left out
 * deliberately: a letter typed inside something already italic changes a
 * length and nothing else, and rebuilding for that drops the keystroke.
 */
export function markShapeOf(input: string, picture?: PictureAt): string {
  return writingRunsOf(input, picture)
    /* A picture is part of the shape: `:plunk` and `:plunk-smug:` are the
       same marks and a different box, and without the flag the one that
       became a picture never got drawn. */
    .map((run) => `${run.faint ? '|' : ''}${run.picture ? '@' : ''}${run.marks.join('.')}`)
    .join(',')
}

/**
 * Write a set of marks onto a real element.
 *
 * For the two places that draw into nodes rather than into React - the box
 * itself, and a bubble over somebody's head - where no class name reaches.
 */
export function dressMarks(el: HTMLElement, marks: Mark[]) {
  el.style.fontWeight = marks.includes('bold') ? '800' : ''
  el.style.fontStyle = marks.includes('italic') ? 'italic' : ''
  const lines: string[] = []
  if (marks.includes('underline')) lines.push('underline')
  if (marks.includes('strike')) lines.push('line-through')
  el.style.textDecoration = lines.join(' ')
}

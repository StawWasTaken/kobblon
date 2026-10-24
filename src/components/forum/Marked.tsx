import { Fragment } from 'react'

/**
 * Text with the searched-for words picked out.
 *
 * **What this is an approximation of.** The matching is done in Postgres by
 * `websearch_to_tsquery` over a stemmed, stop-worded `tsvector`: "running"
 * in the box matches "runs" in the post, and "the" matches nothing at all.
 * Nothing in the browser knows the English snowball stemmer, so this marks
 * whole words and words that *start* with what was typed, which is right
 * for most of what people search for and will occasionally mark nothing in
 * a result that genuinely matched.
 *
 * That is on purpose, and it is the right way round: a result with nothing
 * marked reads as "the match is further down", which is true. The other
 * way - guessing at stems and marking the wrong word - reads as the search
 * being confused about its own answer.
 *
 * `ts_headline` would do this properly, in the database, and was not used
 * for one reason: it would have to run over every row of every page of
 * every search, and it re-parses the whole document to do it. This is a
 * regex over a title.
 */
export function Marked({ text, terms, className }: {
  text: string
  /** What was typed into the box, operators and all. */
  terms: string
  className?: string
}) {
  const pattern = patternFor(terms)
  if (!pattern) return <span className={className}>{text}</span>

  const pieces = text.split(pattern)

  return (
    <span className={className}>
      {pieces.map((piece, at) => (
        /*
         * `split` with one capturing group hands back text, match, text,
         * match … so the odd positions are the matches. Keyed by position
         * because the same word can appear twice and a key of the word
         * itself would collide.
         */
        at % 2 === 1
          ? <mark key={at} className="rounded bg-brand/30 px-0.5 text-white">{piece}</mark>
          : <Fragment key={at}>{piece}</Fragment>
      ))}
    </span>
  )
}

/** The words worth marking, as one regex, or null when there are none. */
function patternFor(terms: string): RegExp | null {
  const words = terms
    /* `websearch_to_tsquery`'s own operators are not words. */
    .replace(/\b(or|and)\b/gi, ' ')
    .replace(/[-"']/g, ' ')
    .split(/\s+/)
    .map((one) => one.trim())
    /*
     * Two letters and under are stop words or noise, and marking "a" and
     * "to" across a title marks the whole title.
     */
    .filter((one) => one.length > 2)
    .map(escape)

  if (!words.length) return null

  /*
   * A word, or a word with more on the end of it: "script" marks
   * "scripting", which is what the stemmer did to find this row in the
   * first place. Not the other way round - "scripting" does not mark
   * "script" - because a regex cannot take letters off a word.
   */
  return new RegExp(`(\\b(?:${words.join('|')})\\w*)`, 'gi')
}

function escape(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The part of a post worth showing under a result: the first match in it,
 * with some of what is around it.
 *
 * Returns null when nothing in the body matched, which is the ordinary
 * case for a result found by its title - and then the row shows nothing
 * rather than the first hundred characters of a post that had nothing to
 * do with it.
 */
export function snippetOf(body: string, terms: string, about = 160): string | null {
  const pattern = patternFor(terms)
  if (!pattern || !body) return null

  const flat = body.replace(/\s+/g, ' ').trim()
  const found = pattern.exec(flat)
  if (!found) return null

  const from = Math.max(0, found.index - Math.floor(about / 3))
  const piece = flat.slice(from, from + about)
  return `${from > 0 ? '…' : ''}${piece}${from + about < flat.length ? '…' : ''}`
}

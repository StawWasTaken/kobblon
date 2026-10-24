import type { ReactNode } from 'react'
import { Linkify } from '@/components/ui/Linkify'
import { cn } from '@/lib/cn'

/**
 * What a forum post may say, and how it is drawn.
 *
 * The composer has a toolbar - headings, bold, italic, strikethrough,
 * quotes, code, lists, a rule, a picture - and a toolbar whose buttons
 * produce marks that nothing renders is the fake functionality this project
 * does not ship. So this is the other half of it: the same small set, read
 * back and drawn.
 *
 * **It never renders HTML, and it cannot be made to.** There is no
 * `dangerouslySetInnerHTML` here and no sanitiser to get wrong. The text is
 * cut into pieces and each piece becomes a React element with the text as a
 * child, so a post containing `<script>` is a post that says `<script>` -
 * not because something stripped it, but because there is no path from this
 * text to markup at all. Anything the parser does not recognise stays
 * exactly as it was written.
 *
 * Deliberately small. No tables, no raw HTML, no autolinked images from
 * arbitrary hosts - a picture is an attachment, which goes through our
 * bucket and our size limit, and the toolbar's picture button adds one of
 * those rather than a URL somebody pasted. A forum post is a thing somebody
 * writes in a box, not a document.
 */

/** One run of inline text: the emphasis marks, read left to right. */
function inline(text: string, keyed: string): ReactNode[] {
  const out: ReactNode[] = []
  /*
   * Code first and on its own pass, because the whole point of `code` is
   * that what is inside it is not read as anything else - a pattern that
   * handled it alongside the others would still have found the asterisks in
   * `**bold**` when somebody wrote it inside backticks to show it.
   */
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~/g
  let at = 0
  let found: RegExpExecArray | null
  let n = 0

  while ((found = pattern.exec(text))) {
    if (found.index > at) {
      out.push(<Linkify key={`${keyed}-t${n}`}>{text.slice(at, found.index)}</Linkify>)
      n += 1
    }
    const key = `${keyed}-m${n}`
    n += 1

    if (found[1] !== undefined) {
      out.push(
        <code key={key} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.9em] text-white/90">
          {found[1]}
        </code>,
      )
    } else if (found[2] !== undefined) {
      out.push(<strong key={key} className="font-extrabold text-white">{found[2]}</strong>)
    } else if (found[3] !== undefined) {
      out.push(<em key={key}>{found[3]}</em>)
    } else {
      out.push(<s key={key} className="text-white/45">{found[4]}</s>)
    }
    at = pattern.lastIndex
  }

  if (at < text.length) out.push(<Linkify key={`${keyed}-t${n}`}>{text.slice(at)}</Linkify>)
  return out
}

type Block =
  | { sort: 'p' | 'quote' | 'h'; lines: string[]; level?: number }
  | { sort: 'list'; items: string[]; numbered: boolean }
  | { sort: 'code'; lines: string[] }
  | { sort: 'rule' }

/**
 * Cut the text into blocks.
 *
 * A hand-written pass rather than a library: the set is nine things, and a
 * markdown library on a page anybody can post to is a parser with a much
 * larger surface than the nine things we want, which is a bad trade.
 */
function cut(body: string): Block[] {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (!line.trim()) { i += 1; continue }

    if (line.trimStart().startsWith('```')) {
      const held: string[] = []
      i += 1
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        held.push(lines[i]); i += 1
      }
      i += 1
      blocks.push({ sort: 'code', lines: held })
      continue
    }

    if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      blocks.push({ sort: 'rule' }); i += 1; continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ sort: 'h', level: heading[1].length, lines: [heading[2]] })
      i += 1
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      const held: string[] = []
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        held.push(lines[i].replace(/^\s*>\s?/, '')); i += 1
      }
      blocks.push({ sort: 'quote', lines: held })
      continue
    }

    const bullet = /^\s*[-*]\s+/
    const number = /^\s*\d+[.)]\s+/
    if (bullet.test(line) || number.test(line)) {
      const numbered = !bullet.test(line)
      const items: string[] = []
      const mine = numbered ? number : bullet
      while (i < lines.length && mine.test(lines[i])) {
        items.push(lines[i].replace(mine, '')); i += 1
      }
      blocks.push({ sort: 'list', items, numbered })
      continue
    }

    const held: string[] = []
    while (
      i < lines.length && lines[i].trim()
      && !/^\s*>\s?/.test(lines[i])
      && !/^(#{1,3})\s+/.test(lines[i])
      && !bullet.test(lines[i]) && !number.test(lines[i])
      && !lines[i].trimStart().startsWith('```')
      && !/^\s*(---+|\*\*\*+)\s*$/.test(lines[i])
    ) {
      held.push(lines[i]); i += 1
    }
    if (held.length) blocks.push({ sort: 'p', lines: held })
    else i += 1
  }

  return blocks
}

const HEADING = ['text-xl', 'text-lg', 'text-base']

export function Markup({ body, className }: { body: string; className?: string }) {
  const blocks = cut(body ?? '')

  return (
    <div className={cn('space-y-4 text-[15px] leading-relaxed text-white/75', className)}>
      {blocks.map((block, at) => {
        const key = `b${at}`

        if (block.sort === 'rule') {
          return <hr key={key} className="border-white/10" />
        }

        if (block.sort === 'code') {
          return (
            <pre
              key={key}
              className="overflow-x-auto rounded-xl border border-white/10 bg-ink p-4 font-mono text-[13px] leading-relaxed text-white/80"
            >
              {block.lines.join('\n')}
            </pre>
          )
        }

        if (block.sort === 'list') {
          const List = block.numbered ? 'ol' : 'ul'
          return (
            <List
              key={key}
              className={cn(
                'space-y-1 pl-5',
                block.numbered ? 'list-decimal' : 'list-disc',
                'marker:text-white/30',
              )}
            >
              {block.items.map((item, n) => (
                <li key={n} className="break-words">{inline(item, `${key}-${n}`)}</li>
              ))}
            </List>
          )
        }

        if (block.sort === 'h') {
          const text = inline(block.lines[0], key)
          const size = HEADING[(block.level ?? 1) - 1] ?? 'text-base'
          return (
            <p key={key} className={cn('font-display font-extrabold text-white', size)}>
              {text}
            </p>
          )
        }

        if (block.sort === 'quote') {
          return (
            <blockquote
              key={key}
              className="border-l-2 border-brand-bright/60 pl-4 text-white/60"
            >
              <span className="whitespace-pre-wrap break-words">
                {inline(block.lines.join('\n'), key)}
              </span>
            </blockquote>
          )
        }

        return (
          <p key={key} className="whitespace-pre-wrap break-words">
            {inline(block.lines.join('\n'), key)}
          </p>
        )
      })}
    </div>
  )
}

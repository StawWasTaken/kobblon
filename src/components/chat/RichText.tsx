import { Fragment } from 'react'
import { runsOf } from '@/lib/rich'
import { gifIn } from '@/lib/gifs'
import { cn } from '@/lib/cn'
import type { Mark } from '@/lib/rich'

const look: Record<Mark, string> = {
  bold: 'font-bold',
  italic: 'italic',
  underline: 'underline underline-offset-2',
  strike: 'line-through',
}

/*
 * A message, drawn.
 *
 * Nothing here builds markup out of what somebody typed. `runsOf` hands
 * back pieces and the marks each piece wears, and they go into real
 * elements - which is the whole reason the parser returns runs rather than
 * a string of HTML. A platform where anybody can type a message is a
 * platform where somebody types a tag.
 *
 * A message that is one Klipy address is drawn as the picture it is, which
 * is how a GIF sent from the Launcher arrives here.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const gif = gifIn(text)

  if (gif) {
    return (
      <img
        src={gif}
        alt="A GIF"
        loading="lazy"
        className={cn('mt-0.5 max-h-56 w-auto max-w-full rounded-xl border border-ink-line', className)}
      />
    )
  }

  return (
    <span className={className}>
      {runsOf(text).map((run, at) => (
        <Fragment key={at}>
          {run.marks.length
            ? <span className={cn(...run.marks.map((mark) => look[mark]))}>{run.text}</span>
            : run.text}
        </Fragment>
      ))}
    </span>
  )
}

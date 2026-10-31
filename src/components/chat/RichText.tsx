import { Fragment } from 'react'
import { runsOf } from '@/lib/rich'
import { gifIn } from '@/lib/gifs'
import { pictureUrl, stickerIn, useNamedPictures } from '@/lib/stickers'
import { mentionBits } from '@/lib/mentions'
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
 * A mention is drawn as a pill, in blue, and only when it names somebody
 * who is actually in this conversation: an `@word` that is nobody stays
 * the characters somebody typed, because a pill on a name that does not
 * exist is a link to nowhere wearing Kobblon's colour. Your own name is
 * drawn stronger - it is the one worth finding in a wall of text.
 *
 * A message that is one Klipy address is drawn as the picture it is, which
 * is how a GIF sent from the Launcher arrives here. A message that is one
 * sticker token - `:plunk-smug:` and nothing else - is drawn the same way,
 * from the list in `pictures_by_name` rather than from anything written
 * down here: a sticker travels as a name, so this is the side that knows
 * what the name looks like, and the Launcher's side knows its own.
 *
 * With words around it a token stays the characters somebody typed. Same
 * rule as the GIF, and the reason is the same - a picture drawn in place of
 * a sentence hides what was actually said.
 */
export function RichText({ text, people, me, className }: {
  text: string
  /** Usernames, lowercased, who may be mentioned here. */
  people?: Set<string>
  me?: string | null
  className?: string
}) {
  const named = useNamedPictures()
  const sticker = stickerIn(text, named)
  const gif = gifIn(text)

  if (sticker) {
    return (
      <img
        src={pictureUrl(sticker.picture)}
        alt={sticker.label}
        title={sticker.label}
        loading="lazy"
        /*
         * Bigger than a GIF and square, because that is what a sticker is:
         * Staw's drawings are 512 and they are the whole message. 128 is
         * the size a GIF settled at after he asked for them smaller, and a
         * sticker beside one should not be the louder of the two.
         */
        className={cn('mt-0.5 h-32 w-32 object-contain', className)}
      />
    )
  }

  if (gif) {
    return (
      <img
        src={gif}
        alt="A GIF"
        loading="lazy"
        /*
         * Smaller than it was. Staw: "in friends chat we shall make the
         * gifs less big". A GIF at 224 pixels tall filled the dock and
         * pushed the conversation around it off the screen, so it read as
         * the message rather than as a thing inside one. Both bounds are
         * set and the aspect ratio is left to the picture: a wide GIF is
         * held by the width and a tall one by the height.
         */
        className={cn(
          'mt-0.5 max-h-40 w-auto max-w-[220px] rounded-xl border border-ink-line',
          className,
        )}
      />
    )
  }

  return (
    <span className={className}>
      {runsOf(text).map((run, at) => {
        const dressed = run.marks.length
          ? cn(...run.marks.map((mark) => look[mark]))
          : undefined

        const bits = people?.size
          ? mentionBits(run.text, (name) => people.has(name), me)
          : [{ text: run.text }]

        return (
          <Fragment key={at}>
            {bits.map((bit, which) => (
              'at' in bit ? (
                <span
                  key={which}
                  className={cn(
                    dressed, 'rounded px-[0.2em] font-extrabold',
                    bit.me ? 'bg-brand/35 text-white' : 'bg-brand/20 text-brand-bright',
                  )}
                >
                  {bit.text}
                </span>
              ) : dressed ? (
                <span key={which} className={dressed}>{bit.text}</span>
              ) : (
                <Fragment key={which}>{bit.text}</Fragment>
              )
            ))}
          </Fragment>
        )
      })}
    </span>
  )
}

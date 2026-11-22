import { Glyph } from '@/components/brand/Glyph'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { worldThumbnail } from '@/lib/worldart'
import { cn } from '@/lib/cn'

/*
 * The wide picture a World wears, which is the first of the pictures it
 * shows of itself.
 *
 * It is always a picture. When that first one is a video, `cover_url` is
 * the still drawn from it when it was added (0370) and this draws a play
 * mark on it - the film itself plays on the World's own page, in Kobblon's
 * player, and nowhere else.
 *
 * That is one rule rather than three. Playing it everywhere meant a card
 * written for an <img> showed a broken picture, a card that did play it
 * showed navy until the first frames arrived, and a shelf of twelve
 * downloaded twelve videos to show twelve thumbnails.
 */
export function WorldArt({ world, className, alt = '', mark = true }: {
  world: { cover_url?: string | null; emblem_url?: string | null; cover_is_video?: boolean }
  className?: string
  alt?: string
  /** The play mark over a video's still. Off where something else says it. */
  mark?: boolean
}) {
  const art = worldThumbnail(world)

  return (
    /* Its own positioned box, so the play mark lands on the picture
       wherever this is used rather than on whichever ancestor happens to
       be positioned. */
    <span className="relative block h-full w-full">
      <img src={art} alt={alt} className={cn('h-full w-full object-cover', className)} />
      {world.cover_is_video && mark && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid h-11 w-11 place-items-center rounded-full border-2 border-white/25 bg-black/55 text-sm text-white/90 backdrop-blur-sm">
            <Glyph icon={faPlay} />
          </span>
        </span>
      )}
    </span>
  )
}

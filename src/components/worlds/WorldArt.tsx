import { worldThumbnail } from '@/lib/worldart'
import { cn } from '@/lib/cn'

/*
 * The wide picture a World wears, which is the first of the pictures it
 * shows of itself - and which may be a video.
 *
 * Staw: "if its a video then its played in mute across all pages by
 * default". So this is one component rather than an <img> in nine places:
 * a card that draws an <img> at an .mp4 shows a broken picture, and the
 * rule about muting has to hold everywhere or it holds nowhere.
 *
 * Muted, looping, and `playsInline` so a phone plays it where it sits
 * rather than throwing it full screen. `preload="metadata"` because a
 * shelf of twelve of these should not fetch twelve videos to show twelve
 * thumbnails.
 */
export function WorldArt({ world, className, alt = '' }: {
  world: { cover_url?: string | null; emblem_url?: string | null; cover_is_video?: boolean }
  className?: string
  alt?: string
}) {
  const art = worldThumbnail(world)

  if (world.cover_is_video && world.cover_url) {
    return (
      <video
        src={world.cover_url}
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
        aria-label={alt || undefined}
        className={cn('h-full w-full object-cover', className)}
      />
    )
  }

  return <img src={art} alt={alt} className={cn('h-full w-full object-cover', className)} />
}

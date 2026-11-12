/*
 * The backdrop an avatar stands in: Staw's own two, one per theme.
 *
 * A photographer's sweep - soft light behind the figure, corners falling
 * away, floor meeting wall in a line below the feet.
 *
 * **Chosen by CSS, not by `useTheme`.** This mounts in places that have no
 * providers at all: a bare page under `tools/site/`, a card being drawn
 * before anybody signs in, the Workspace. A hook would throw in exactly
 * those places, which is the oldest mistake in this project - `useAuth`
 * without its provider took a panel down in the application and rendered
 * perfectly here. `data-theme` is on the document element either way, so a
 * selector answers the same question with nothing to supply.
 *
 * Every picture is in the markup and all but one are hidden, rather than
 * one `img` whose source is computed: a swap mid-render is a flash of the
 * wrong backdrop.
 *
 * Six of them now, because an appearance changes this too - Staw: "also the
 * appearances changes the avatar background (for yourself ofc, theme
 * appearances are personal)" - and he drew each season for both the dark
 * interface and the light one. `data-appearance` is the other half of the
 * selector and is set by the account; where nothing set it, the ordinary
 * pair is drawn.
 */
import { cn } from '@/lib/cn'
import { asset } from '@/lib/asset'

const BACKDROPS = [
  { look: 'default', dark: '/brand/studio-dark.webp', light: '/brand/studio-light.webp' },
  { look: 'halloween', dark: '/brand/studio-halloween-dark.webp', light: '/brand/studio-halloween-light.webp' },
  { look: 'christmas', dark: '/brand/studio-christmas-dark.webp', light: '/brand/studio-christmas-light.webp' },
] as const

export function Studio({ className, children }: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('relative isolate overflow-hidden bg-[#0b0d16]', className)}>
      {BACKDROPS.map((one) => (
        <img
          key={one.look}
          data-look={one.look}
          data-mode="dark"
          src={asset(one.dark)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="kob-backdrop absolute inset-0 -z-10 h-full w-full select-none object-cover"
        />
      ))}
      {BACKDROPS.map((one) => (
        <img
          key={`${one.look}-light`}
          data-look={one.look}
          data-mode="light"
          src={asset(one.light)}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="kob-backdrop absolute inset-0 -z-10 h-full w-full select-none object-cover"
        />
      ))}
      {/*
        * The one place a gradient is allowed: between a picture and the
        * surface it sits on.
        *
        * Staw, on the avatar stage in a profile: "it feels weird it creates
        * a big contrast that gives a 'too much' vibe, doesnt really fit the
        * aesthetic we want". The backdrop is his own artwork and is not
        * touched - what was wrong is the edge. A photographer's sweep is a
        * lit, pale rectangle, and dropped hard-cornered into a dark card it
        * reads as a lightbox cut into the page rather than a place the
        * avatar is standing.
        *
        * So the corners fall to the card's own colour and the middle is
        * left exactly as he drew it. The stage keeps its light where the
        * avatar is and stops being a slab where it meets the panel.
        */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(118% 100% at 50% 32%, transparent 38%, rgb(var(--ink-card) / 0.55) 82%, rgb(var(--ink-card) / 0.92) 100%)',
        }}
      />
      {children}
    </div>
  )
}

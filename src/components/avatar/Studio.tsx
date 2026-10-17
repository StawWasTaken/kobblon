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
      {children}
    </div>
  )
}

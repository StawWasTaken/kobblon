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
 * Both pictures are in the markup and one is hidden, rather than one `img`
 * whose source is computed: a swap mid-render is a flash of the wrong
 * backdrop, and both of these are three kilobytes.
 */
import { cn } from '@/lib/cn'
import { asset } from '@/lib/asset'

export function Studio({ className, children }: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <div className={cn('relative isolate overflow-hidden bg-[#0b0d16]', className)}>
      <img
        src={asset('/brand/studio-dark.webp')}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 -z-10 h-full w-full select-none object-cover [html[data-theme='light']_&]:hidden"
      />
      <img
        src={asset('/brand/studio-light.webp')}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 -z-10 hidden h-full w-full select-none object-cover [html[data-theme='light']_&]:block"
      />
      {children}
    </div>
  )
}

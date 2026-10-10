import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { Kobby } from '@/components/brand/Kobby'
import { PixelField } from '@/components/brand/PixelField'

/**
 * Something for a broken page to be, other than nothing.
 *
 * Anything thrown while rendering used to take the whole document with it and
 * leave an empty dark rectangle, which tells nobody anything and offers
 * nobody a way out. This catches it and says so, with the two things worth
 * trying.
 *
 * The cause goes to the console, not onto the page: a stack trace is for
 * somebody fixing it, and this screen is for somebody who just wanted to open
 * a page.
 */

/** The one cause common enough to name, and only when it is really that. */
const STALE = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i

export class Boundary extends Component<{ children: ReactNode }, { broke: Error | null }> {
  state: { broke: Error | null } = { broke: null }

  static getDerivedStateFromError(broke: Error) {
    return { broke }
  }

  componentDidCatch(broke: Error, info: ErrorInfo) {
    // Left where somebody looking into it will find it, rather than sent
    // anywhere: this is a page that failed, not an event to collect.
    console.error('Kobblon could not draw this page.', broke, info.componentStack)
  }

  render() {
    if (!this.state.broke) return this.props.children

    const stale = STALE.test(this.state.broke.message)

    /*
     * Plain anchors and plain buttons rather than the shared components:
     * whatever broke may well have been the router, or a component this
     * would otherwise be asking to render a second time.
     */
    return (
      <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-4 py-16 text-white">
        <PixelField className="opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/50 to-ink" />

        <div className="relative flex w-full max-w-md flex-col items-center text-center">
          <Kobby mood="construction" size="lg" />
          <h1 className="mt-6 font-display text-4xl font-extrabold">This page would not draw</h1>

          <p className="mt-3 text-white/65">
            {stale
              ? 'Kobblon was updated while your tab was open, and the piece this page asked for had already been replaced. Loading it again fetches the new one.'
              : 'Something went wrong on the way to the screen. Loading it again usually clears it.'}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-onbrand transition-colors hover:bg-brand-bright"
            >
              Load it again
            </button>
            <a
              href="/home"
              className="inline-flex h-11 items-center rounded-xl border border-ink-line bg-ink-card px-5 text-sm font-bold transition-colors hover:bg-ink-hover"
            >
              Go home
            </a>
          </div>

          <p className="mt-6 text-xs text-muted">
            Still happening?{' '}
            <a href="/support" className="font-bold text-white/70 underline-offset-2 hover:underline">
              Tell us about it
            </a>
          </p>
        </div>
      </div>
    )
  }
}

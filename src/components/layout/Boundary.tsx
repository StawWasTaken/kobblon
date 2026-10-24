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

type State = { broke: Error | null; where: string | null }

export class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { broke: null, where: null }

  static getDerivedStateFromError(broke: Error) {
    return { broke }
  }

  componentDidCatch(broke: Error, info: ErrorInfo) {
    // Left where somebody looking into it will find it, rather than sent
    // anywhere: this is a page that failed, not an event to collect.
    console.error('Kobblon could not draw this page.', broke, info.componentStack)
    this.setState({ where: info.componentStack ?? null })
  }

  render() {
    if (!this.state.broke) return this.props.children

    const stale = STALE.test(this.state.broke.message)

    /* Everything somebody would be asked for, in one block to copy. */
    const details = [
      `${this.state.broke.name}: ${this.state.broke.message}`,
      `at ${window.location.pathname}${window.location.search}`,
      (this.state.where ?? '').trim().split('\n').slice(0, 8).join('\n'),
    ].filter(Boolean).join('\n')

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
          <h1 className="mt-6 font-display text-3xl font-extrabold sm:text-4xl">This page would not draw</h1>

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

          {/*
            * What actually broke, on the page rather than only in the
            * console.
            *
            * Staw reported this screen from a phone - the chat button and
            * the drawer both ending here - and there was nothing to go on:
            * a phone has no console, the screen said the same sentence it
            * says for everything, and neither one could be reproduced
            * against fixtures. A stack trace is for somebody fixing it,
            * which is still true; a one-line cause is for somebody who can
            * photograph it, and without that line a report of this screen
            * is a report that something, somewhere, went wrong.
            *
            * Closed by default so it stays the apology it was, and the
            * copy button is there because nobody retypes a stack off a
            * phone screen.
            */}
          <details className="mt-7 w-full text-left">
            <summary className="cursor-pointer list-none text-center text-xs font-bold text-white/40 hover:text-white/70">
              What went wrong
            </summary>

            <pre className="mt-3 w-full max-w-full max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-ink-line bg-ink-card p-3 text-left text-[11px] leading-relaxed text-white/60">
              {details}
            </pre>

            <button
              onClick={() => { navigator.clipboard?.writeText(details) }}
              className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg border border-ink-line bg-ink-card text-xs font-bold transition-colors hover:bg-ink-hover"
            >
              Copy the details
            </button>
          </details>

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

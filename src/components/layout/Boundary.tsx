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
 * **It shows what broke, and it did not use to.** The detail was behind
 * `import.meta.env.DEV`, so on the real site this page said "it would not
 * draw" and nothing else - which meant the only report anybody could make
 * was that sentence, and the only way to find the cause was to guess. A
 * person who can paste one line has reported a bug; a person who can only
 * say "it broke" has reported a mood. The text is a stack trace, not a
 * secret: it is in the bundle everybody already downloaded.
 */

/** The one cause common enough to name, and only when it is really that. */
const STALE = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically/i

export class Boundary extends Component<
  { children: ReactNode },
  { broke: Error | null; where: string; copied: boolean }
> {
  state: { broke: Error | null; where: string; copied: boolean } =
    { broke: null, where: '', copied: false }

  static getDerivedStateFromError(broke: Error) {
    return { broke }
  }

  componentDidCatch(broke: Error, info: ErrorInfo) {
    // Left where somebody looking into it will find it, rather than sent
    // anywhere: this is a page that failed, not an event to collect.
    console.error('Kobblon could not draw this page.', broke, info.componentStack)
    this.setState({ where: (info.componentStack ?? '').trim() })
  }

  private report() {
    const { broke, where } = this.state
    return [
      `${broke?.name ?? 'Error'}: ${broke?.message ?? ''}`,
      `at ${window.location.pathname}${window.location.search}`,
      '',
      (broke?.stack ?? '').split('\n').slice(0, 6).join('\n'),
      '',
      where.split('\n').slice(0, 8).join('\n'),
    ].join('\n').trim()
  }

  private copy() {
    void navigator.clipboard?.writeText(this.report())
      .then(() => this.setState({ copied: true }))
      .catch(() => {})
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

        <div className="relative flex w-full max-w-xl flex-col items-center text-center">
          <Kobby mood="construction" size="lg" />
          <p className="mt-6 font-display text-6xl font-extrabold text-[#7f92ff]">Oops</p>
          <h1 className="mt-2 font-display text-3xl font-extrabold">This page would not draw</h1>

          <p className="mt-2 max-w-md text-white/65">
            {stale
              ? 'Kobblon was updated while your tab was open, and the piece this page asked for had already been replaced. Loading it again fetches the new one.'
              : 'Something in this page went wrong on the way to the screen. Loading it again often clears it — and if it does not, the lines below say what happened.'}
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center rounded-xl bg-brand px-4 text-sm font-bold text-onbrand transition-colors hover:bg-brand-bright"
            >
              Load it again
            </button>
            <a
              href="/home"
              className="inline-flex h-10 items-center rounded-xl border border-ink-line bg-ink-card px-4 text-sm font-bold transition-colors hover:bg-ink-hover"
            >
              Go home
            </a>
            <a
              href="/support"
              className="inline-flex h-10 items-center rounded-xl border border-ink-line bg-ink-card px-4 text-sm font-bold transition-colors hover:bg-ink-hover"
            >
              Tell us about it
            </a>
          </div>

          {/*
            * Open, not folded away. Somebody who has to find and press
            * "details" before they can tell you anything will tell you
            * nothing, and this is the one screen where the technical line
            * is the most useful thing on it.
            */}
          <div className="mt-8 w-full overflow-hidden rounded-xl border border-ink-line bg-ink-card text-left">
            <div className="flex items-center justify-between gap-3 border-b border-ink-line px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                What happened
              </p>
              <button
                onClick={() => this.copy()}
                className="rounded-lg border border-ink-line px-2.5 py-1 text-xs font-bold text-white/80 transition-colors hover:bg-ink-hover"
              >
                {this.state.copied ? 'Copied' : 'Copy it'}
              </button>
            </div>
            <pre className="max-h-56 overflow-auto px-3 py-2.5 text-[11px] leading-relaxed text-white/60">
              {this.report()}
            </pre>
          </div>

          <p className="mt-3 text-xs text-muted">
            Pasting that into a support ticket is the whole of a useful bug report.
          </p>
        </div>
      </div>
    )
  }
}

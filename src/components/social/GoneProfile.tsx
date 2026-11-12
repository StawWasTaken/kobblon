import { Glyph } from '@/components/brand/Glyph'
import { faUserSlash } from '@fortawesome/free-solid-svg-icons'
import { Missing } from '@/components/brand/Missing'
import { Button } from '@/components/ui/Button'

/**
 * Somebody's page, with nobody in it.
 *
 * Staw asked for this to be redesigned, and the thing that was wrong with
 * it is that it was a card in the middle of nothing: the profile it
 * replaces is a banner, a face over the edge of it and a column of
 * panels, and this was a small box floating where all of that had been.
 * It is the same shape as a profile now and empty inside it, which is
 * what being gone looks like.
 *
 * Nothing of theirs is drawn. No accent colour, because the accent was
 * theirs; the banner is an empty hatch and the face is the mark every
 * other missing picture on the site gets. The name is the row's own name:
 * since 0331 closing an account renames it to `AccountDeleted<id>` for
 * real, so this prints what every post and every friend list prints
 * rather than a word painted over a row that still says who they were.
 */
export function GoneProfile({ handle }: { handle: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card">
      {/* The banner that is not there. Hatched rather than flat, so it
          reads as a space somebody has left rather than as a panel that
          failed to load. */}
      <div className="relative h-28 bg-ink-raised text-white sm:h-36">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 14px)',
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-ink-card to-transparent" />
      </div>

      {/* `relative`, or the banner above wins: a positioned element paints
          over a static sibling that comes after it, and the face came out
          as a half circle with its top behind the hatch. */}
      <div className="relative -mt-12 flex flex-col items-center px-6 pb-10 text-center sm:-mt-14">
        <div className="h-24 w-24 overflow-hidden rounded-full border-4 border-ink-card bg-ink sm:h-28 sm:w-28">
          <Missing className="h-full w-full" />
        </div>

        <span className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-ink-line bg-ink-raised px-3 py-1 text-mini font-bold uppercase tracking-[0.14em] text-muted">
          <Glyph icon={faUserSlash} className="text-tiny" />
          Account deleted
        </span>

        <h1 className="mt-3 font-display text-2xl font-extrabold sm:text-3xl">{handle}</h1>
        <p className="mt-1 text-sm text-muted">@{handle}</p>

        <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
          This account was deleted for breaking the Terms of Service and the
          Community Guidelines.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button to="/discover" variant="subtle">Discover Worlds</Button>
          <Button to="/people" variant="ghost">Find somebody else</Button>
        </div>
      </div>
    </section>
  )
}

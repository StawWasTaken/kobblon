import { Kobby } from '@/components/brand/Kobby'
import { Wordmark } from '@/components/brand/Wordmark'
import { Button } from '@/components/ui/Button'
import { useTitle } from '@/hooks/useTitle'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowsRotate, faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons'

/**
 * What the whole website is while the shutters are down.
 *
 * Kobby in a hard hat, the house's own words if whoever threw the switch
 * left any, and one button that tries again. Nothing else: no navigation,
 * because every page it could point at is this page, and no sign-in form,
 * because signing in changes nothing for anybody this screen applies to.
 *
 * The one address still open underneath is `/login`, so that staff who can
 * walk past this can get at a session to turn it off again. It is not
 * linked from here; somebody who needs it knows it.
 *
 * `outage` is the other way here: not a switch somebody threw, but the site
 * noticing it has stopped being answered and drawing this instead of twenty
 * "that did not load" boxes.
 *
 * **It says nothing about why.** Staw: "make it a general maintenance page
 * with the famous We're making things more awesome". An earlier draft of
 * this named the database, and he is right that it should not: somebody
 * who came here to play does not need our infrastructure explained to them,
 * and a page that says which part of the machinery broke is a page that
 * tells anybody looking for a weak spot where to push. One maintenance
 * page, one set of words, whichever way it was reached.
 *
 * The `outage` flag survives only so this one does not show a note that
 * staff wrote for the other case - there is nobody to have written one.
 *
 * On the drawing of it: everything used to float in the middle of a black
 * page with a pixel pattern behind it, so there was nothing to hold on to
 * and Kobby was the size of the heading. It is a card now, the same edge
 * and the same lift as every other card on the site, with him beside the
 * words rather than above them. No pattern, no gradient, nothing moving.
 */
export default function Maintenance({ note, outage }: {
  note?: string | null
  /** The database stopped answering. Nobody threw a switch. */
  outage?: boolean
}) {
  useTitle('Back shortly')

  const message = !outage && note?.trim() ? note.trim() : null

  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col items-center">
        <Wordmark to="/" className="h-7" always />

        <div className="mt-6 w-full rounded-2xl border-2 border-b-4 border-ink-line bg-ink-card p-6 sm:p-8">
          <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:items-start sm:text-left">
            {/* Nothing behind him. There was a halo here for a day because
                he is black on a nearly black page; Staw: "dont add a
                shining stuff behind the under construction". */}
            <Kobby mood="construction" size="lg" className="shrink-0" />

            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border-2 border-ink-line bg-ink px-2.5 py-1 text-tiny font-extrabold uppercase tracking-wide text-muted">
                <Glyph icon={faScrewdriverWrench} className="text-tiny" />
                Maintenance
              </p>

              <h1 className="mt-3 font-display text-2xl font-extrabold leading-tight sm:text-3xl">
                Kobblon will be right back
              </h1>

              <p className="mt-2 text-sm leading-relaxed text-white/70">
                We're making things more awesome. Nothing of yours is lost.
              </p>
            </div>
          </div>

          {/* What staff wrote, kept apart from the standing words so it
              reads as somebody saying something rather than as more copy. */}
          {message && (
            <p className="mt-5 rounded-xl border-2 border-ink-line bg-ink p-3 text-sm text-white/80">
              {message}
            </p>
          )}

          <div className="mt-6 border-t-2 border-ink-line pt-5">
            <Button
              className="w-full sm:w-auto"
              icon={faArrowsRotate}
              onClick={() => window.location.reload()}
            >
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

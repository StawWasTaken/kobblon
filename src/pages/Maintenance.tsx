import { Kobby } from '@/components/brand/Kobby'
import { Wordmark } from '@/components/brand/Wordmark'
import { PixelField } from '@/components/brand/PixelField'
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
 */
export default function Maintenance({ note, outage }: {
  note?: string | null
  /** The database stopped answering. Nobody threw a switch. */
  outage?: boolean
}) {
  useTitle('Back shortly')

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-ink px-4 py-16">
      <PixelField className="opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 to-ink" />

      <div className="relative flex w-full max-w-lg flex-col items-center text-center">
        <Wordmark to="/" className="h-8" always />

        {/* Nothing behind him. There was a halo here for a day because he
            is black on a nearly black page; Staw: "dont add a shining
            stuff behind the under construction". */}
        <Kobby mood="construction" size="xl" className="mt-8" />

        <p className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-ink-line bg-ink-card px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-muted">
          <Glyph icon={faScrewdriverWrench} className="text-[10px]" />
          Maintenance
        </p>

        <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">
          Kobblon will be right back
        </h1>

        <p className="mt-3 text-white/70">
          {!outage && note?.trim()
            ? note
            : "We're making things more awesome. Nothing of yours is lost, and this page lets you straight back in as soon as it can."}
        </p>

        <Button
          className="mt-7"
          icon={faArrowsRotate}
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </div>
    </div>
  )
}

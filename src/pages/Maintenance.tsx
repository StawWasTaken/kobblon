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
 * noticing the database has stopped answering and drawing this instead of
 * twenty "that did not load" boxes. The drawing is the same on purpose -
 * what somebody wants to know is "it is not me and it is being dealt with",
 * and that is true either way - but the words are not, because "somebody is
 * working on the place" is a promise and nobody has made it. It also says
 * out loud that it is watching, since this one goes away by itself.
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

        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-ink-line bg-ink-card px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-muted">
          <Glyph icon={faScrewdriverWrench} className="text-[10px]" />
          Maintenance
        </p>

        <h1 className="mt-3 font-display text-3xl font-extrabold sm:text-4xl">
          Kobblon will be right back
        </h1>

        <p className="mt-3 text-white/70">
          {outage
            ? 'Kobblon cannot reach its database right now. Nothing you did caused this and nothing of yours is lost. This page is checking every few seconds and will let you straight back in.'
            : note?.trim()
              ? note
              : 'Somebody is working on the place. Nothing is lost, nothing is broken, and it will be back shortly.'}
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

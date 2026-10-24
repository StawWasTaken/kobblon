/*
 * The advert, playing to itself.
 *
 * Staw wanted it always running, silent, with a click buying the sound -
 * which is right for a front page: a still frame with a play button on it
 * is an invitation, and most people decline an invitation. A clip already
 * moving is just the thing itself.
 *
 * It is `MediaPlayer` in ambient mode rather than a player of its own. The
 * one on an item's page and this one are the same component, so the scrub
 * bar, the volume and the blocked context menu are the same here as there -
 * and a second player would have been a second thing to fix every time.
 *
 * Nothing is downloaded until it is scrolled to. The file is five megabytes
 * and this section is well below the fold, so a download that starts on
 * arrival is paid for by everybody who never gets here.
 */
import { MediaPlayer } from '@/components/create/MediaPlayer'
import { Band } from '@/components/about/Band'
import { Reveal } from '@/components/about/Reveal'
import { Eyebrow, Title } from '@/components/about/Type'
import { asset } from '@/lib/asset'

export function Commercial() {
  return (
    /*
     * On `Band` rather than on a lane of its own. It used to be
     * `max-w-[1400px]` next to the page's `max-w-6xl`, so the advert's
     * heading started a hundred and forty pixels left of every other
     * heading on the page - the kind of thing nobody can name and
     * everybody can see.
     */
    <Band tone="night" edge>
      <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
        <Reveal>
          <Eyebrow>Thirty seconds</Eyebrow>
          <Title className="mt-4">
            This is what people
            <span className="block text-brand-bright">are building on it</span>
          </Title>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/60">
            Every place in it is on Kobblon now, made by somebody with an
            account and no more tools than you get for free.
          </p>
        </Reveal>

        <Reveal delay={120}>
          <MediaPlayer
            kind="video"
            ambient
            src={asset('/brand/kobblon-its-free.mp4')}
            poster={asset('/brand/landing-interior.png')}
            className="shadow-2xl"
          />
        </Reveal>
      </div>
    </Band>
  )
}

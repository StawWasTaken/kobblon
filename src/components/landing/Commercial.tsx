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
import { asset } from '@/lib/asset'

export function Commercial() {
  return (
    <section className="border-y border-ink-line bg-ink-sunken">
      <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-4 py-14 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <p className="font-display text-xs uppercase tracking-[0.24em] text-brand-bright">
            Thirty seconds
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            This is what people
            <span className="block text-brand-bright">are building on it.</span>
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
            Every place in it is on Kobblon now, made by somebody with an
            account and no more tools than you get for free.
          </p>
        </div>

        <MediaPlayer
          kind="video"
          ambient
          src={asset('/brand/kobblon-its-free.mp4')}
          poster={asset('/brand/landing-interior.png')}
          className="shadow-2xl"
        />
      </div>
    </section>
  )
}

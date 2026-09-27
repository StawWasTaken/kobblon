/*
 * The advert, which plays when somebody asks for it.
 *
 * It is five megabytes. Autoplaying it, or even preloading it, means every
 * arrival pays for a film most of them will not watch - on a phone, before
 * they have decided whether they care. So the poster frame stands in until
 * the play button is pressed, and only then does the file exist.
 *
 * `preload="none"` is the half people forget: a <video> tag with a src
 * fetches metadata on sight, and on some browsers a good deal more than
 * metadata. Nothing is requested here until somebody has asked.
 *
 * The element is mounted from the start and covered by the poster, rather
 * than created when the button is pressed. That is not a detail: `play()`
 * is only allowed while the browser still counts the click as the reason
 * for it, and waiting a frame for a newly rendered element to exist spends
 * exactly that. It looked fine and played nothing.
 */
import { useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { asset } from '@/lib/asset'

export function Commercial() {
  const film = useRef<HTMLVideoElement>(null)
  const [asked, setAsked] = useState(false)

  const start = () => {
    setAsked(true)
    void film.current?.play().catch(() => {
      // Refused by the browser - the controls are there, and it is theirs.
    })
  }

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
            Not a trailer for something coming later. Every place in it is on
            Kobblon now, made by somebody with an account and no more tools
            than you get for free.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-ink-line bg-ink shadow-2xl">
          <video
            ref={film}
            src={asset('/brand/kobblon-its-free.mp4')}
            controls={asked}
            playsInline
            preload="none"
            className="aspect-video w-full bg-ink"
          />

          {!asked && (
            <button
              type="button"
              onClick={start}
              className="group absolute inset-0 block"
              aria-label="Play the Kobblon advert"
            >
              {/*
                * Cropped to the left of that picture on purpose: the right
                * half is the wordmark, and the play button sat exactly on
                * top of it. A poster frame should be the room, not a second
                * logo with a button through it.
                */}
              <img
                src={asset('/brand/landing-interior.png')}
                alt=""
                className="absolute inset-0 h-full w-full object-cover object-left"
              />
              <span className="absolute inset-0 bg-ink/30 transition-colors group-hover:bg-ink/10" />
              <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-brand text-white shadow-xl transition-transform group-hover:scale-110">
                <FontAwesomeIcon icon={faPlay} className="ml-0.5 text-xl" />
              </span>
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

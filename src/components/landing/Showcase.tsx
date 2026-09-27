/*
 * The first thing a stranger sees.
 *
 * Roblox's 2016 page was one photograph of a place somebody built, filling
 * the screen, with the sign-up beside it and the builder credited in the
 * corner. Staw sent it as the template and it is a good one: the argument
 * for the platform is the picture, and the caption says a person made it
 * rather than the company saying anything at all.
 *
 * So this is Kobblon HQ, credited to the Kobblon account, which is whose it
 * is. When there is a better World to show - and it should be somebody
 * else's - the picture and the two lines under it change and nothing else
 * does.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPlay, faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons'
import { SignupForm } from '@/components/auth/SignupForm'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { asset } from '@/lib/asset'

/** The World in the picture, and who made it. */
const SHOWING = {
  world: 'Kobblon HQ',
  builder: 'kobblon',
  picture: '/brand/landing-towers.webp',
}

export function Showcase() {
  const navigate = useNavigate()
  const { signInAsGuest } = useAuth()
  const [sent, setSent] = useState<string | null>(null)
  const [guestPending, setGuestPending] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const enterAsGuest = async () => {
    setGuestPending(true)
    setGuestError(null)
    try {
      await signInAsGuest()
      navigate('/home')
    } catch {
      setGuestError('Guest mode is not switched on for this site yet.')
    } finally {
      setGuestPending(false)
    }
  }

  return (
    <section className="relative isolate overflow-hidden">
      <img
        src={asset(SHOWING.picture)}
        alt={`${SHOWING.world}, built on Kobblon`}
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_35%]"
      />
      {/*
        * Dark on the left where the words go, left alone on the right where
        * the building is. The picture is the argument, so covering all of it
        * with a flat scrim would be arguing less.
        */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/95 via-ink/40 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-ink to-transparent" />

      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 lg:grid-cols-[1fr_390px] lg:py-16">
        <div className="max-w-xl self-center">
          {/*
            * The wordmark and one line under it, the way Roblox put "The
            * Game Powered by Players." under theirs.
            *
            * The two share a width so the strip ends exactly where the
            * wordmark does, and it is pulled up into the wordmark's own
            * transparent edge so the two read as one mark rather than as a
            * picture with a caption below it.
            *
            * The strip is there so the sentence is legible over sky or over
            * a building without darkening the whole picture to suit it.
            */}
          <div className="w-full max-w-[400px]">
            <img
              src={asset('/brand/wordmark2.png')}
              alt="Kobblon"
              className="block w-full select-none"
            />
            <p className="-mt-2.5 bg-ink/75 px-3 py-2 text-center font-display text-base text-white backdrop-blur-sm sm:text-lg">
              The game built by players.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button to="/discover" size="lg" variant="brand">
              <FontAwesomeIcon icon={faPlay} />
              Start playing
            </Button>
            <Button to="/download" size="lg" variant="ghost">
              Get the Launcher
            </Button>
          </div>

          <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link to="/login" className="font-bold text-white underline-offset-4 hover:underline">
              Log in
            </Link>
            <Link to="/signup" className="font-bold text-white underline-offset-4 hover:underline">
              Sign up
            </Link>
            <span className="text-white/35">or</span>
            <button
              onClick={enterAsGuest}
              disabled={guestPending}
              className="font-bold text-white/70 underline-offset-4 hover:text-white hover:underline disabled:opacity-60"
            >
              {guestPending ? 'One moment…' : 'look around as a guest'}
            </button>
          </p>
          <p className="mt-2 text-xs text-white/35">
            Free, and for people aged 15 and over.
          </p>
          {guestError && <p className="mt-2 text-sm text-danger">{guestError}</p>}

        </div>

        {/*
          * The sign-up itself, not a button that goes to one, which is the
          * reason Roblox's page worked. `SignupForm` is the component
          * /signup already uses rather than a second one that would drift
          * apart from it the first time a field moved.
          */}
        <div className="self-center rounded-2xl border border-ink-line bg-ink-raised/95 p-5 shadow-2xl backdrop-blur lg:justify-self-end">
          {/*
            * Once the form has been sent the card says so rather than
            * offering itself again. Somebody who has just signed up and is
            * looking at an empty sign-up form assumes it did not work.
            */}
          {sent ? (
            <div className="py-6 text-center">
              <FontAwesomeIcon icon={faEnvelopeOpenText} className="text-3xl text-space-bright" />
              <h2 className="mt-3 font-display text-xl">Check your email</h2>
              <p className="mt-2 text-sm text-muted">
                We sent a link to <span className="font-bold text-white">{sent}</span>.
                Open it and your account is ready.
              </p>
              <Button to="/login" variant="subtle" size="sm" className="mt-4">
                Go to log in
              </Button>
            </div>
          ) : (
            <>
              <h2 className="font-display text-xl">Sign up and start building</h2>
              <p className="mt-1 text-sm text-muted">It is free, and it always will be.</p>
              <div className="mt-4">
                <SignupForm onSent={setSent} />
              </div>
              {/*
                * Both real pages, from the card. The form here is the quick
                * way in and the pages are the full ones - /signup also
                * claims a guest account, which this card cannot, and
                * /login has the password reset. Staw asked for them to be
                * reachable and "it is in the top bar" is not reachable.
                */}
              <p className="mt-4 text-center text-xs text-muted">
                Already have an account?{' '}
                <Link to="/login" className="font-bold text-link hover:underline">
                  Log in
                </Link>
                <span className="mx-1.5 text-white/20">·</span>
                <Link to="/signup" className="font-bold text-link hover:underline">
                  Full sign-up page
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      {/*
        * The credit, the way Roblox credited a builder on theirs. It is the
        * claim above made checkable: a name, and a page you can open to see
        * what else they made.
        */}
      <div className="pointer-events-none absolute bottom-3 left-0 w-full px-4">
        <p className="pointer-events-auto font-display text-sm text-white/75 [text-shadow:0_2px_0_rgba(0,0,0,0.6)]">
          {SHOWING.world}
          <span className="block text-xs text-white/55">
            Built by{' '}
            <Link to={`/u/${SHOWING.builder}`} className="text-white/75 hover:text-white hover:underline">
              @{SHOWING.builder}
            </Link>
          </span>
        </p>
      </div>
    </section>
  )
}

import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowLeft, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Wordmark } from '@/components/brand/Wordmark'
import { PixelField } from '@/components/brand/PixelField'
import { Reveal } from '@/components/about/Reveal'
import { Floaters } from '@/components/about/Floaters'
import { Lane } from '@/components/about/Band'
import { Eyebrow } from '@/components/about/Type'
import { SignupForm } from '@/components/auth/SignupForm'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/hooks/useAuth'
import { useForceDark } from '@/hooks/useTheme'
import { useTitle } from '@/hooks/useTitle'
import { cn } from '@/lib/cn'

/*
 * The door.
 *
 * One line, one form, and nothing else. It has been three layouts in a
 * week and Staw's note on this one is the shortest: keep it simple. So the
 * three cards about what an account is for are gone - somebody on this
 * page has already decided - and what is left is the sentence, in the
 * spirit of Roblox's "sign up and start having fun", and the fields.
 *
 * The two modes say different things now, which they did not before - one
 * headline for both is one of them being wrong, and it was the login one:
 * somebody logging in is not signing up and does not need telling what
 * signing up is for. Staw asked for "Signup and get ready to have fun!",
 * slightly upgraded, short and memorable. "Get to the fun bit" is that
 * sentence with the throat-clearing taken out, and it says the same thing
 * about what the account is for.
 *
 * One column down the middle rather than the pitch-beside-the-form it was.
 * The split layout only ever worked on a wide screen - on a phone the
 * whole left half was `hidden`, so half of the page did not exist for most
 * of the people using it, and the headline had to be written twice.
 *
 * No photograph behind it. Staw asked for the towers off this page, and a
 * World behind a password field was arguing for the platform at the one
 * moment somebody has already agreed; what is left is the pixel wash every
 * At Kobblon page opens on, the brand light, and the faces drifting in the
 * margins.
 *
 * The three lines under the form are drawn with Staw's own icons rather
 * than with Font Awesome glyphs, because there are pictures of a World, of
 * the marketplace and of people in this product already.
 */

export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  useForceDark()
  const { session, profile, signInAsGuest } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [guestPending, setGuestPending] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const isSignup = mode === 'signup'
  // A guest is signed in already, so the usual bounce to Home would shut the
  // door on the one thing they came here to do: keep what they made.
  const claiming = isSignup && !!profile?.is_guest

  useTitle(claiming ? 'Keep your account' : isSignup ? 'Sign up' : 'Log in')

  /*
   * Where to go once they are in.
   *
   * `RequireAuth` puts the address somebody was trying to reach in `next`,
   * so following a link to a page that needs an account ends up on that
   * page rather than on Home. Only a path on this site is honoured, and
   * never one of these two screens - an open redirect is a login page
   * that will send somebody anywhere a link tells it to, and bouncing
   * back here is a loop.
   */
  const asked = params.get('next') ?? ''
  const after = asked.startsWith('/') && !asked.startsWith('//')
    && !asked.startsWith('/login') && !asked.startsWith('/signup')
    ? asked
    : '/home'

  if (session && !claiming) return <Navigate to={after} replace />

  const enterAsGuest = async () => {
    setGuestPending(true)
    setGuestError(null)
    try {
      await signInAsGuest()
      navigate(after)
    } catch (err) {
      setGuestError(
        err instanceof Error && err.message.includes('limit')
          ? err.message
          : 'Guest mode is not switched on for this site yet.',
      )
    } finally {
      setGuestPending(false)
    }
  }

  return (
    /*
     * One column down the middle, and one screen with nothing to scroll on
     * a desktop. Staw asked for both: "make the card in the center", and
     * before that "the whole card is visible in the screen theres no need to
     * scroll down (when on pc actually)".
     *
     * Centred and fitting are in tension, because the form is as tall as its
     * fields and a headline above it has to come out of the same 900 pixels.
     * What gives is the headline: it is one size down from the At Kobblon
     * `Title`, the lead is a single short line, and the header is tight. The
     * card itself is untouched - shrinking the thing somebody has to fill in
     * to make room for the words would be the wrong way round.
     */
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink text-white">
      <PixelField className="opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(90rem_50rem_at_50%_-20%,rgba(27,52,232,0.5),transparent_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/80 to-ink" />
      <Floaters />

      <Lane>
        <header className="relative flex items-center justify-between py-5">
          <Wordmark to="/" className="h-6" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 transition-colors hover:text-white"
          >
            <Glyph icon={faArrowLeft} />
            Back to the front
          </Link>
        </header>
      </Lane>

      <Lane className="flex flex-1 items-center justify-center">
        <main className="w-full max-w-xl py-10 lg:py-2">
          {/* ------------------------------------------------- the words */}
          {/*
           * One line, and in the ordinary case nothing else. The eyebrow and
           * the explaining sentence only appear for a guest claiming their
           * account, whose card is shorter by a tab row and a guest button
           * and so has the room for them.
           */}
          <div className="text-center">
            {claiming && (
              <Reveal>
                <Eyebrow>You have been looking around</Eyebrow>
              </Reveal>
            )}
            <Reveal delay={70}>
              {/*
               * Written out rather than `Title level={1}`, because `cn`
               * joins and does not merge: a second `text-[clamp(...)]` beside
               * the one Title already carries loses to whichever Tailwind
               * emitted later, and the heading stayed at the page-title size
               * however small the override said. Same trap as `Character`
               * and its `relative`.
               */}
              <h1 className={cn(
                'font-display text-[clamp(1.8rem,2.6vw,2.2rem)] font-extrabold leading-[1.05] tracking-tight',
                claiming && 'mt-4',
              )}>
                {claiming ? (
                  <>
                    Keep what you
                    <span className="block text-brand-bright">already made</span>
                  </>
                ) : mode === 'login' ? (
                  <>
                    Welcome back. <span className="text-brand-bright">Let's go.</span>
                  </>
                ) : (
                  <>
                    Sign up and <span className="text-brand-bright">get to the fun bit</span>
                  </>
                )}
              </h1>
            </Reveal>
            {claiming && (
              <Reveal delay={140}>
                <p className="mx-auto mt-4 max-w-sm text-sm leading-relaxed text-white/55">
                  The Worlds you entered, the people you met and anything you collected stay exactly
                  where they are.
                </p>
              </Reveal>
            )}
          </div>

          {/* ----------------------------------------------- the card */}
          {/* The gap is the mark's: half of it hangs above the card, so a
              `mt-6` here put it straight through the headline. */}
          <section className="mx-auto mt-12 w-full max-w-md sm:mt-14">
            {/*
              * Flat, and the mark sitting on its top edge.
              *
              * Both are Staw's, through the applications session, and both
              * are about one design across the two: "i want it to be not
              * with a shadow, flat, like for the roblox one", and "the
              * kobblon wordmark to be over both the card & the background
              * (like the minecraft launcher)".
              *
              * So `shadow-pop` is gone and the lifted bottom edge with it -
              * a stroke and a fill, sitting on the page. The mark is out of
              * the flow, centred on the top edge, with `z-10` so the card's
              * own surface does not cover its lower half and `pt-12` to
              * make the room it now needs.
              */}
            <div className="relative rounded-2xl border-2 border-white/10 bg-ink-card/85 p-5 pt-12 backdrop-blur-xl sm:p-6 sm:pt-14">
              <Wordmark
                to={null}
                always
                /* A height and nothing else, so the drawing keeps its own
                   proportions - the images inside are `h-full w-auto` and
                   nothing here gives them a width to be squeezed into. */
                className="absolute left-1/2 top-0 z-10 h-14 w-auto -translate-x-1/2 -translate-y-1/2 sm:h-16"
              />
              <div className="relative">
                {sentTo ? (
                  <div className="text-center">
                    <h1 className="font-display text-2xl font-extrabold">Check your email</h1>
                    <p className="mt-2 text-sm leading-relaxed text-white/55">
                      We sent a confirmation link to {sentTo}. Click it and your account is ready.
                    </p>
                    <Button variant="subtle" to="/login" block className="mt-6">
                      Back to log in
                    </Button>
                  </div>
                ) : claiming ? (
                  <>
                    <span className="inline-flex items-center gap-2 rounded-full border-2 border-space/40 bg-space/15 px-3 py-1 text-mini font-extrabold uppercase tracking-wide text-space-bright">
                      <Glyph icon={faCircleCheck} />
                      Nothing gets lost
                    </span>
                    <h1 className="mt-4 font-display text-2xl font-extrabold">
                      Keep this account
                    </h1>
                    <p className="mb-5 mt-1 text-sm leading-relaxed text-white/55">
                      You are signed in as {profile?.display_name}. Pick a name and a password and
                      this same account becomes yours for good.
                    </p>
                    <SignupForm
                      claiming
                      onSent={setSentTo}
                      onClaimed={() => navigate(after)}
                    />
                  </>
                ) : (
                  <>
                    {isSignup
                      ? (
                        /*
                         * An empty address means there was nothing to send,
                         * so there is nothing to wait for: the account is
                         * made and this tab is already signed in to it.
                         */
                        <SignupForm onSent={(to) => (to ? setSentTo(to) : navigate('/home'))} />
                      )
                      : <LoginForm />}

                    <div className="my-3.5 flex items-center gap-3 text-mini font-bold uppercase tracking-wide text-white/25">
                      <span className="h-px flex-1 bg-white/10" />
                      or
                      <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <Button variant="subtle" block loading={guestPending} onClick={enterAsGuest}>
                      Play as a guest
                    </Button>
                    {guestError && (
                      <p className="mt-2 text-center text-xs text-danger">{guestError}</p>
                    )}

                    {/*
                      * The sentence is the switcher.
                      *
                      * Staw: "i dont want the 'login/signup' switcher but
                      * instead the text like you put it 'new here' thingy
                      * opens the signup page (like clicking on the text
                      * itself is used as the switcher, instead of an ugly
                      * switcher thingy)".
                      *
                      * The tab row it replaces gave half the width of the
                      * card to the rarer of the two people on this screen,
                      * which is what made it read as furniture. A line
                      * still switches both ways, and `next` rides along
                      * exactly as the tabs carried it.
                      */}
                    {/* The Launcher's own line, which is the one Staw is
                        looking at: smaller than body text, bold, and the
                        half that is the link in brand blue. */}
                    <p className="mt-4 text-center text-xs font-bold text-white/45">
                      {isSignup ? 'Got an account? ' : 'New here? '}
                      <Link
                        to={`${isSignup ? '/login' : '/signup'}${
                          asked && after !== '/home' ? `?next=${encodeURIComponent(after)}` : ''
                        }`}
                        replace
                        className="text-brand-bright hover:underline"
                      >
                        {isSignup ? 'Log in' : 'Make a Kobblon account'}
                      </Link>
                    </p>
                  </>
                )}
              </div>
            </div>

            <p className="mt-3.5 text-center text-xs text-white/35">
              <Link to="/policies/terms" className="font-semibold hover:text-white">Terms</Link>
              <span className="px-2">&middot;</span>
              <Link to="/policies/guidelines" className="font-semibold hover:text-white">Guidelines</Link>
              <span className="px-2">&middot;</span>
              <Link to="/policies" className="font-semibold hover:text-white">Policies</Link>
            </p>
          </section>
        </main>
      </Lane>
    </div>
  )
}

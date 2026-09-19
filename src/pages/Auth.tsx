import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft, faLayerGroup, faShapes, faUsers, faCircleCheck,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Button } from '@/components/ui/Button'
import { Wordmark } from '@/components/brand/Wordmark'
import { Kobby } from '@/components/brand/Kobby'
import { PixelField } from '@/components/brand/PixelField'
import { SignupForm } from '@/components/auth/SignupForm'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/hooks/useAuth'
import { useForceDark } from '@/hooks/useTheme'
import { useTitle } from '@/hooks/useTitle'
import { cn } from '@/lib/cn'

/** One line about what an account is for, beside the form that makes one. */
function Promise_({ icon, title, body }: { icon: IconDefinition; title: string; body: string }) {
  return (
    <li className="flex gap-3.5">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-sm text-white">
        <FontAwesomeIcon icon={icon} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-white">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-white/55">{body}</span>
      </span>
    </li>
  )
}

export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  useForceDark()
  const { session, profile, signInAsGuest } = useAuth()
  const navigate = useNavigate()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [guestPending, setGuestPending] = useState(false)
  const [guestError, setGuestError] = useState<string | null>(null)

  const isSignup = mode === 'signup'
  // A guest is signed in already, so the usual bounce to Home would shut the
  // door on the one thing they came here to do: keep what they made.
  const claiming = isSignup && !!profile?.is_guest

  useTitle(claiming ? 'Keep your account' : isSignup ? 'Sign Up' : 'Log In')

  if (session && !claiming) return <Navigate to="/home" replace />

  const enterAsGuest = async () => {
    setGuestPending(true)
    setGuestError(null)
    try {
      await signInAsGuest()
      navigate('/home')
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
    <div className="relative min-h-dvh overflow-hidden bg-ink text-white">
      <PixelField className="opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(90rem_50rem_at_15%_-10%,rgba(27,52,232,0.45),transparent_60%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/85 to-ink" />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <Wordmark to="/" className="h-6" />
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/50 transition-colors hover:text-white"
          >
            <FontAwesomeIcon icon={faArrowLeft} />
            Back to the front
          </Link>
        </header>

        <main className="grid flex-1 items-center gap-10 pb-16 lg:grid-cols-[1fr_26rem] lg:gap-16">
          {/* -------------------------------------------------- the pitch */}
          <section className="hidden lg:block">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/40">
              {claiming ? 'You have been looking around' : 'Kobblon'}
            </p>
            <h1 className="mt-4 font-display text-6xl font-extrabold leading-[0.88]">
              Make Something
              <span className="block text-brand-bright">Nobody Else Has</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/60">
              {claiming
                ? 'Keep the account you are using. The Worlds you entered, the people you met and anything you collected stay exactly where they are.'
                : 'A World is your corner of the internet. Build it out of whatever you like, open the door, and see who walks in.'}
            </p>

            <ul className="mt-9 max-w-md space-y-5">
              <Promise_
                icon={faLayerGroup}
                title="Your own World"
                body="Built the way you want it, published when you say so, visited by whoever you share it with."
              />
              <Promise_
                icon={faShapes}
                title="Everything in Create"
                body="Decals, sounds, video and fonts made by people here, used by their number so the credit sticks."
              />
              <Promise_
                icon={faUsers}
                title="People to build with"
                body="Friends, Communities with their own walls and ranks, and events worth turning up to."
              />
            </ul>
          </section>

          {/* --------------------------------------------------- the card */}
          <section className="w-full justify-self-center lg:justify-self-end">
            <div className="relative rounded-3xl border border-white/10 bg-ink-card/90 p-6 shadow-pop backdrop-blur-xl sm:p-8">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-b from-white/10 to-transparent opacity-60"
              />
              <Kobby
                mood={sentTo ? 'notification' : claiming ? 'crown' : 'default'}
                size="sm"
                bob={false}
                /* Left of the card: on a wide screen the right corner is
                   where the header link lives. */
                className="pointer-events-none absolute -left-6 -top-11 hidden h-20 -rotate-6 sm:block"
              />

              <div className="relative">
                {/* On a phone the pitch is gone, so the tagline comes here. */}
                <h2 className="mb-6 font-display text-3xl font-extrabold leading-[0.9] lg:hidden">
                  Make Something
                  <span className="block text-brand-bright">Nobody Else Has</span>
                </h2>

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
                    <span className="inline-flex items-center gap-2 rounded-full border border-space/40 bg-space/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-space-bright">
                      <FontAwesomeIcon icon={faCircleCheck} />
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
                      onClaimed={() => navigate('/home')}
                    />
                  </>
                ) : (
                  <>
                    <div className="mb-6 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                      {(['login', 'signup'] as const).map((which) => (
                        <Link
                          key={which}
                          to={which === 'login' ? '/login' : '/signup'}
                          replace
                          className={cn(
                            'rounded-lg py-2 text-center text-sm font-bold transition-colors',
                            mode === which
                              ? 'bg-brand text-white'
                              : 'text-white/55 hover:bg-white/5 hover:text-white',
                          )}
                        >
                          {which === 'login' ? 'Log In' : 'Sign Up'}
                        </Link>
                      ))}
                    </div>

                    <h1 className="font-display text-2xl font-extrabold">
                      {isSignup ? 'Make an account' : 'Welcome back'}
                    </h1>
                    <p className="mb-5 mt-1 text-sm text-white/55">
                      {isSignup
                        ? 'Free, and it takes about a minute.'
                        : 'Log in with your username.'}
                    </p>

                    {isSignup ? <SignupForm onSent={setSentTo} /> : <LoginForm />}

                    <div className="my-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wide text-white/25">
                      <span className="h-px flex-1 bg-white/10" />
                      or
                      <span className="h-px flex-1 bg-white/10" />
                    </div>

                    <Button variant="subtle" block loading={guestPending} onClick={enterAsGuest}>
                      Play as Guest
                    </Button>
                    {guestError && (
                      <p className="mt-2 text-center text-xs text-danger">{guestError}</p>
                    )}
                    <p className="mt-2 text-center text-[11px] text-white/35">
                      Guests can look around. Making things needs an account, and you can turn a
                      guest into one later without losing anything.
                    </p>
                  </>
                )}
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-white/35">
              <Link to="/policies/terms" className="font-semibold hover:text-white">Terms</Link>
              <span className="px-2">·</span>
              <Link to="/policies/guidelines" className="font-semibold hover:text-white">Guidelines</Link>

            </p>
          </section>
        </main>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faArrowLeft, faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import type { KobIcon } from '@/components/brand/Icon'
import { Icon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { Wordmark } from '@/components/brand/Wordmark'
import { PixelField } from '@/components/brand/PixelField'
import { Reveal } from '@/components/about/Reveal'
import { Floaters } from '@/components/about/Floaters'
import { Lane } from '@/components/about/Band'
import { Eyebrow, Title } from '@/components/about/Type'
import { SignupForm } from '@/components/auth/SignupForm'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/hooks/useAuth'
import { useForceDark } from '@/hooks/useTheme'
import { useTitle } from '@/hooks/useTitle'
import { cn } from '@/lib/cn'

/*
 * The door.
 *
 * One column down the middle rather than the pitch-beside-the-form it was:
 * the words, the form, and what an account is for underneath it. The split
 * layout only ever worked on a wide screen - on a phone the whole left half
 * was `hidden`, so half of the page did not exist for most of the people
 * using it, and the headline had to be written twice.
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

/** One line about what an account is for, under the form that makes one. */
function Promise_({ icon, title, body }: { icon: KobIcon; title: string; body: string }) {
  return (
    <li className="rounded-3xl border border-white/10 bg-ink-card/50 p-6">
      <Icon name={icon} tone="currentColor" className="h-7 w-7 text-brand-bright" />
      <span className="mt-4 block font-display text-lg font-extrabold text-white">{title}</span>
      <span className="mt-2 block text-sm leading-relaxed text-white/55">{body}</span>
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
      <PixelField className="opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(90rem_50rem_at_50%_-20%,rgba(27,52,232,0.5),transparent_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/80 to-ink" />
      <Floaters />

      <div className="relative">
        <Lane>
          <header className="flex items-center justify-between py-6">
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

        <Lane>
          <main className="pb-24 pt-10 sm:pt-16">
            {/* ------------------------------------------------- the words */}
            <div className="mx-auto max-w-3xl text-center">
              <Reveal>
                <Eyebrow>{claiming ? 'You have been looking around' : 'Kobblon'}</Eyebrow>
              </Reveal>
              <Reveal delay={70}>
                <Title level={1} className="mt-5">
                  {claiming ? (
                    <>
                      Keep what you
                      <span className="block text-brand-bright">already made</span>
                    </>
                  ) : (
                    <>
                      One account,
                      <span className="block text-brand-bright">every World</span>
                    </>
                  )}
                </Title>
              </Reveal>
              <Reveal delay={140}>
                <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/60">
                  {claiming
                    ? 'The Worlds you entered, the people you met and anything you collected stay exactly where they are. Pick a name and a password and this same account becomes yours.'
                    : 'Kobblon is an online sandbox platform filled with user-generated 3D worlds. Build one, publish it, and walk into anybody else\u2019s.'}
                </p>
              </Reveal>
            </div>

            {/* ----------------------------------------------- the card */}
            <section className="mx-auto mt-12 w-full max-w-md">
            <div className="relative rounded-3xl border border-white/10 bg-ink-card/85 p-6 shadow-pop backdrop-blur-xl sm:p-8">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-b from-white/10 to-transparent opacity-60"
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
                    <span className="inline-flex items-center gap-2 rounded-full border border-space/40 bg-space/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-space-bright">
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
                <span className="px-2">·</span>
                <Link to="/policies" className="font-semibold hover:text-white">Policies</Link>
              </p>
            </section>

            {/* ------------------------------------ what it is an account for */}
            <ul className="mx-auto mt-16 grid max-w-5xl gap-3 sm:grid-cols-3">
              <Reveal as="li" delay={120} className="h-full">
                <Promise_
                  icon="world"
                  title="Your own World"
                  body="Built your way in Kobblon Workspace, published when you say so."
                />
              </Reveal>
              <Reveal as="li" delay={190} className="h-full">
                <Promise_
                  icon="assets"
                  title="Everything in Create"
                  body="Meshes, decals, sounds and fonts, made by people here and sold to each other."
                />
              </Reveal>
              <Reveal as="li" delay={260} className="h-full">
                <Promise_
                  icon="people"
                  title="People to build with"
                  body="Friends, Communities with their own walls and ranks, and events worth turning up to."
                />
              </Reveal>
            </ul>
          </main>
        </Lane>
      </div>
    </div>
  )
}

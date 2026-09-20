import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCube, faHammer, faRightToBracket, faCircleCheck, faArrowRight, faUserGroup,
  faShieldHalved, faClock, faRightLeft,
} from '@fortawesome/free-solid-svg-icons'
import { Wordmark } from '@/components/brand/Wordmark'
import { PixelField } from '@/components/brand/PixelField'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/hooks/useAuth'
import { useForceDark } from '@/hooks/useTheme'
import { useTitle } from '@/hooks/useTitle'
import { mintAppCode } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'

/*
 * Signing in to a Kobblon application.
 *
 * No Kobblon application asks for a password. A desktop window is easy to
 * forge and a browser is not, so the browser signs in and hands over a code
 * that is worth one exchange and expires in ten minutes.
 *
 * The consent step is not decoration: this page can be linked to from
 * anywhere, so it never hands anything over until somebody presses the
 * button. A page that opens an application the moment it loads is a page that
 * signs you in to somebody else's copy of it.
 */

const apps = {
  launcher: {
    name: 'Kobblon Launcher',
    short: 'Launcher',
    what: 'plays Worlds',
    icon: faCube,
    scheme: 'kobblon',
  },
  creator: {
    name: 'Kobblon World Creator',
    short: 'Creator',
    what: 'builds Worlds',
    icon: faHammer,
    scheme: 'kobblon-creator',
  },
} as const

/**
 * What handing an account over does and does not mean.
 *
 * Written out because this is the one moment somebody is deciding whether
 * to trust an application, and "are you sure?" is not an answer to that.
 */
const promises = [
  { icon: faShieldHalved, text: 'It never sees your password. Kobblon hands it a code, not your details.' },
  { icon: faClock, text: 'The code is good once, for ten minutes, and only for this application.' },
  { icon: faRightLeft, text: 'You can sign it out from inside the application whenever you like.' },
]

type Which = keyof typeof apps

export default function AppSignIn() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { profile, signOut } = useAuth()

  // /creator/sign-in or /launcher/sign-in, and nothing else reaches this page.
  const named = pathname.split('/')[1] ?? ''
  const which = (named in apps ? named : 'creator') as Which
  const app = apps[which]

  /* Creator's own random string, handed back untouched so it can tell its
     request from anybody else's. Never anything of ours. */
  const state = params.get('state') ?? ''

  useForceDark()
  useTitle(`Open ${app.name}`)

  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [trouble, setTrouble] = useState<string | null>(null)

  const open = async () => {
    setSending(true)
    setTrouble(null)
    try {
      const code = await mintAppCode(which)
      const link = `${app.scheme}://signin?code=${encodeURIComponent(code)}`
        + (state ? `&state=${encodeURIComponent(state)}` : '')
      setSent(true)
      window.location.href = link
    } catch (err) {
      setTrouble(err instanceof Error ? err.message : 'That did not work.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-white">
      <PixelField className="opacity-25" />
      {/* The light sits behind the card rather than above the fold, so the
          card is standing in something instead of floating in a void. */}
      <div className="absolute inset-0 bg-[radial-gradient(52rem_34rem_at_50%_42%,rgba(27,52,232,0.62),transparent_64%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/45 to-ink" />

      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
        <Wordmark to="/" className="mx-auto mb-7 h-6" />

        <div className="overflow-hidden rounded-3xl border border-white/15 bg-ink-card/85 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          {/*
            * A band across the top, in the app's own colour, carrying its
            * mark. It says which application is asking before a word is
            * read, which is the whole job of this screen.
            */}
          <div className="relative border-b border-white/10 bg-gradient-to-br from-brand/35 via-brand/10 to-transparent px-7 py-6">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-xl text-onbrand shadow-lg shadow-brand/30">
                <FontAwesomeIcon icon={app.icon} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-white/45">
                  Sign in to
                </p>
                <h1 className="truncate font-display text-2xl font-extrabold leading-tight">
                  {app.name}
                </h1>
                <p className="truncate text-sm text-white/55">
                  The Kobblon application that {app.what}.
                </p>
              </div>
            </div>
          </div>

          <div className="px-7 py-7">
            {/* ------------------------------------------------- signed out */}
            {!profile && (
              <>
                <p className="mb-5 flex items-center gap-2 text-sm font-bold text-white/70">
                  <FontAwesomeIcon icon={faRightToBracket} className="text-xs" />
                  Sign in to your Kobblon account
                </p>
                <LoginForm />
                <p className="mt-5 text-center text-sm text-white/45">
                  No account?{' '}
                  <Link to="/signup" className="font-bold text-link hover:underline">
                    Make one
                  </Link>
                </p>
              </>
            )}

            {/* -------------------------------------------------- signed in */}
            {!!profile && !sent && (
              <div className="space-y-6">
                {/*
                  * The account on one side, the application on the other,
                  * and what is happening between them. A person should be
                  * able to read this screen at a glance and know what they
                  * are about to agree to.
                  */}
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <Avatar
                      src={avatarOf(profile)}
                      name={profile.display_name}
                      size="md"
                      className="rounded-xl"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{profile.display_name}</p>
                      <p className="truncate text-xs text-white/50">@{profile.username}</p>
                    </div>
                  </div>

                  <FontAwesomeIcon icon={faArrowRight} className="shrink-0 text-white/30" />

                  <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/20 text-brand-bright">
                      <FontAwesomeIcon icon={app.icon} />
                    </span>
                    <p className="text-sm font-bold">{app.short}</p>
                  </div>
                </div>

                <ul className="space-y-3">
                  {promises.map((one) => (
                    <li key={one.text} className="flex gap-3 text-sm leading-relaxed text-white/60">
                      <FontAwesomeIcon
                        icon={one.icon}
                        className="mt-0.5 w-4 shrink-0 text-center text-white/35"
                      />
                      {one.text}
                    </li>
                  ))}
                </ul>

                {trouble && (
                  <p
                    role="alert"
                    className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
                  >
                    {trouble}
                  </p>
                )}

                <div className="space-y-3">
                  <Button block size="lg" icon={app.icon} onClick={open} loading={sending}>
                    Open {app.short}
                  </Button>

                  <button
                    onClick={() => signOut()}
                    className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-white/45 transition-colors hover:text-white"
                  >
                    <FontAwesomeIcon icon={faUserGroup} className="text-xs" />
                    Use a different account
                  </button>
                </div>
              </div>
            )}

            {/* ------------------------------------------------- handed over */}
            {sent && (
              <div className="space-y-4 py-2 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-space/15 text-3xl text-space-bright">
                  <FontAwesomeIcon icon={faCircleCheck} />
                </span>
                <p className="font-display text-xl font-extrabold">
                  You can go back to {app.short}
                </p>
                <p className="text-sm leading-relaxed text-white/55">
                  It should be signing in now. This tab can be closed.
                </p>
                <Link
                  to="/home"
                  className="inline-flex items-center gap-2 text-sm font-bold text-link hover:underline"
                >
                  Back to Kobblon
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-white/40">
          Do not have it?{' '}
          <Link to="/download" className="font-bold text-link hover:underline">
            Get {app.short}
          </Link>
        </p>
      </div>
    </div>
  )
}

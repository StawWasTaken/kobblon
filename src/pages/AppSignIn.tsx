import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCube, faHammer, faRightToBracket, faCircleCheck, faArrowRight, faUserGroup,
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
 * that is worth one exchange and expires in two minutes.
 *
 * The consent step is not decoration: this page can be linked to from
 * anywhere, so it never hands anything over until somebody presses the
 * button. A page that opens an application the moment it loads is a page that
 * signs you in to somebody else's copy of it.
 */

const apps = {
  launcher: {
    name: 'Kobblon Launcher',
    what: 'plays Worlds',
    icon: faCube,
    scheme: 'kobblon',
  },
  creator: {
    name: 'Kobblon World Creator',
    what: 'builds Worlds',
    icon: faHammer,
    scheme: 'kobblon-creator',
  },
} as const

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
      <PixelField className="opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(70rem_40rem_at_50%_-10%,rgba(27,52,232,0.42),transparent_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/85 to-ink" />

      <div className="relative mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-12">
        <Wordmark to="/" className="mx-auto mb-10 h-6" />

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand text-lg text-onbrand">
              <FontAwesomeIcon icon={app.icon} />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-extrabold leading-tight">{app.name}</h1>
              <p className="text-sm text-white/55">The Kobblon application that {app.what}.</p>
            </div>
          </div>

          {/* ------------------------------------------------- signed out */}
          {!profile && (
            <div className="mt-7">
              <p className="mb-5 flex items-center gap-2 text-sm font-bold text-white/70">
                <FontAwesomeIcon icon={faRightToBracket} className="text-xs" />
                Sign in to open {app.name}
              </p>
              <LoginForm />
              <p className="mt-5 text-center text-sm text-white/45">
                No account?{' '}
                <Link to="/signup" className="font-bold text-link hover:underline">
                  Make one
                </Link>
              </p>
            </div>
          )}

          {/* -------------------------------------------------- signed in */}
          {!!profile && !sent && (
            <div className="mt-7 space-y-5">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-card/70 p-4">
                <Avatar
                  src={avatarOf(profile)}
                  name={profile.display_name}
                  size="md"
                  className="rounded-xl"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{profile.display_name}</p>
                  <p className="truncate text-sm text-white/50">@{profile.username}</p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-white/60">
                {app.name} will be signed in as this account. It never sees your password, and
                you can sign it out again from the application.
              </p>

              {trouble && (
                <p role="alert" className="text-sm font-semibold text-danger">{trouble}</p>
              )}

              <Button block size="lg" icon={app.icon} onClick={open} loading={sending}>
                Open {app.name}
              </Button>

              <button
                onClick={() => signOut()}
                className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-white/50 transition-colors hover:text-white"
              >
                <FontAwesomeIcon icon={faUserGroup} className="text-xs" />
                Use a different account
              </button>
            </div>
          )}

          {/* ------------------------------------------------- handed over */}
          {sent && (
            <div className="mt-7 space-y-4 text-center">
              <FontAwesomeIcon icon={faCircleCheck} className="text-3xl text-space-bright" />
              <p className="font-display text-xl font-extrabold">You can go back to {app.name}</p>
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

        <p className="mt-6 text-center text-sm text-white/40">
          Do not have it?{' '}
          <Link to="/download" className="font-bold text-link hover:underline">
            Get {app.name}
          </Link>
        </p>
      </div>
    </div>
  )
}

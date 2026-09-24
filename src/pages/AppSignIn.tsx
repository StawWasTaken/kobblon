import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { Wordmark } from '@/components/brand/Wordmark'
import { PixelField } from '@/components/brand/PixelField'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { LoginForm } from '@/components/auth/LoginForm'
import { useAuth } from '@/hooks/useAuth'
import { useForceDark } from '@/hooks/useTheme'
import { useTitle } from '@/hooks/useTitle'
import { mintAppCode } from '@/lib/api'
import { asset } from '@/lib/asset'
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
 * button. A page that opens an application the moment it loads is a page
 * that signs you in to somebody else's copy of it.
 *
 * Short on purpose. Somebody arriving here wants to press one button, and a
 * page explaining a one-time code to them is a page they scroll past.
 */

const apps = {
  launcher: {
    name: 'Kobblon Launcher',
    short: 'Launcher',
    /* The Launcher wears the website's mark; Create's pages and the World
       Creator are the same thing in two places, so they wear the same one. */
    mark: '/brand/favicon.png',
    scheme: 'kobblon',
  },
  creator: {
    name: 'Kobblon Workspace',
    short: 'Workspace',
    mark: '/brand/favicon-create.png',
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
      <PixelField className="opacity-25" />
      <div className="absolute inset-0 bg-[radial-gradient(52rem_34rem_at_50%_42%,rgba(27,52,232,0.62),transparent_64%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/45 to-ink" />

      <div className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
        <Wordmark to="/" className="mx-auto mb-8 h-6" />

        <div className="rounded-3xl border border-white/15 bg-ink-card/85 p-7 text-center shadow-[0_30px_80px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl">
          <img src={asset(app.mark)} alt="" className="mx-auto h-14 w-14 rounded-2xl" />

          <h1 className="mt-4 font-display text-xl font-extrabold leading-tight">
            {app.name}
          </h1>

          {/* --------------------------------------------------- signed out */}
          {!profile && (
            <div className="mt-6 text-left">
              <LoginForm />
              <p className="mt-5 text-center text-sm text-white/45">
                No account?{' '}
                <Link to="/signup" className="font-bold text-link hover:underline">
                  Make one
                </Link>
              </p>
            </div>
          )}

          {/* ---------------------------------------------------- signed in */}
          {!!profile && !sent && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-center gap-2.5 text-sm">
                <Avatar
                  src={avatarOf(profile)}
                  name={profile.display_name}
                  size="sm"
                  className="rounded-lg"
                />
                <span className="truncate font-bold">{profile.display_name}</span>
              </div>

              {trouble && (
                <p role="alert" className="text-sm font-semibold text-danger">{trouble}</p>
              )}

              <Button block size="lg" onClick={open} loading={sending}>
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
          )}

          {/* --------------------------------------------------- handed over */}
          {sent && (
            <div className="mt-6 space-y-3">
              <FontAwesomeIcon icon={faCircleCheck} className="text-3xl text-space-bright" />
              <p className="font-display text-lg font-extrabold">
                Go back to {app.short}
              </p>
              <p className="text-sm text-white/50">This tab can be closed.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

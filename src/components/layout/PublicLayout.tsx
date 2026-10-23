import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { faBars, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { Wordmark } from '@/components/brand/Wordmark'
import { SiteFooter } from './SiteFooter'
import { useAuth } from '@/hooks/useAuth'

/**
 * The side of Kobblon anyone can see without an account: the front page
 * and the policy pages. The signed-in side has its own layout.
 */
/** The four places a stranger might be going. One list, both bars. */
const PUBLIC_LINKS = [
  { to: '/discover', label: 'Play' },
  { to: '/create', label: 'Create' },
  { to: '/communities', label: 'Communities' },
  { to: '/download', label: 'Download' },
]

function PublicTopbar() {
  const { signInWithName } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)
  const [menu, setMenu] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFailed(false)
    try {
      await signInWithName(username.trim(), password)
    } catch {
      setFailed(true)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b-2 border-brand-ink bg-brand-deep">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:gap-6 sm:px-6">
        {/*
          * The four links below are `sm:flex`, so on a phone the front page
          * had no navigation at all: Play, Create, Communities and the
          * download were reachable only by scrolling the whole page. Same
          * three lines as the signed-in bar, in the same place - left of
          * the mark, where a thumb is.
          */}
        <button
          type="button"
          onClick={() => setMenu((open) => !open)}
          aria-label={menu ? 'Close navigation' : 'Open navigation'}
          aria-expanded={menu}
          className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white/85 transition-colors hover:bg-white/15 sm:hidden"
        >
          <Glyph icon={menu ? faXmark : faBars} className="text-lg" />
        </button>

        <Wordmark to="/" className="h-5" />

        {/*
          * The four places a stranger might be going. Communities and the
          * Launcher were reachable only by scrolling the whole front page,
          * which is a long way to go for a download link.
          */}
        <nav className="hidden items-center gap-5 text-sm font-bold text-white/75 sm:flex">
          {PUBLIC_LINKS.map((link) => (
            <Link key={link.to} to={link.to} className="hover:text-white">{link.label}</Link>
          ))}
        </nav>

        <form onSubmit={submit} className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor="public-username">Username</label>
          <input
            id="public-username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            className="hidden h-8 w-36 rounded-md border border-white/20 bg-black/30 px-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/50 md:block"
          />
          <label className="sr-only" htmlFor="public-password">Password</label>
          <input
            id="public-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="hidden h-8 w-32 rounded-md border border-white/20 bg-black/30 px-2.5 text-sm text-white placeholder:text-white/40 focus:border-white/50 md:block"
          />
          <Button type="submit" size="sm" variant="subtle" className="hidden md:inline-flex">Log In</Button>
          <Button size="sm" to="/login" className="md:hidden">Log In</Button>
          {/* The one thing this bar is for, if you have not got an account. */}
          <Button size="sm" to="/signup" variant="yes">Sign Up</Button>
          {failed && (
            <p role="alert" className="hidden text-xs text-danger lg:block">Wrong username or password</p>
          )}
        </form>
      </div>

      {menu && (
        <nav
          className="border-t border-onbrand/10 bg-brand-deep px-4 pb-3 pt-1 sm:hidden"
          aria-label="Site"
        >
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setMenu(false)}
              className="block rounded-lg px-2 py-2.5 text-sm font-bold text-white/85 hover:bg-white/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}

export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      <PublicTopbar />

      <main id="main">
        <Outlet />
      </main>

      <SiteFooter />
    </div>
  )
}

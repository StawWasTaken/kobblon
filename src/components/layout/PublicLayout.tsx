import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Wordmark } from '@/components/brand/Wordmark'
import { SiteFooter } from './SiteFooter'
import { useAuth } from '@/hooks/useAuth'

/**
 * The side of Kobblon anyone can see without an account: the front page
 * and the policy pages. The signed-in side has its own layout.
 */
function PublicTopbar() {
  const { signInWithName } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)

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
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Wordmark to="/" className="h-5" />

        {/*
          * The four places a stranger might be going. Communities and the
          * Launcher were reachable only by scrolling the whole front page,
          * which is a long way to go for a download link.
          */}
        <nav className="hidden items-center gap-5 text-sm font-bold text-white/75 sm:flex">
          <Link to="/discover" className="hover:text-white">Play</Link>
          <Link to="/create" className="hover:text-white">Create</Link>
          <Link to="/communities" className="hover:text-white">Communities</Link>
          <Link to="/download" className="hover:text-white">Download</Link>
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

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { faUser, faLock } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'

/**
 * Signing in with a username and a password.
 *
 * One form, used by the login page and by the page that opens a Kobblon
 * application. Two forms would be two places to fix when sign-in changes, and
 * sign-in is the thing that must not have two of anything.
 */
export function LoginForm() {
  const { signInWithName } = useAuth()
  const [params] = useSearchParams()
  const [username, setUsername] = useState(params.get('username') ?? '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      await signInWithName(username.trim(), password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wrong username or password.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Username"
        icon={faUser}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        required
      />
      <Input
        label="Password"
        icon={faLock}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        error={error}
      />
      <Button type="submit" size="lg" block loading={pending}>Log In</Button>
    </form>
  )
}

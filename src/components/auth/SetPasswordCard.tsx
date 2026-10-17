/*
 * The card somebody comes back to after staff made their guest account
 * real.
 *
 * Staw: "make that superadmins can force guest accounts to become normal
 * accounts (the user when coming back to the website will already be
 * logged in but therell be a card to ask them to put a password)".
 *
 * So they are signed in, and nothing of theirs has moved. What is missing
 * is the one thing a guest account never had: a way back into it from
 * anywhere else. Until there is a password, the account still lives in
 * this browser and nowhere else, which is what the card says rather than
 * dressing it up as a reward.
 *
 * It cannot be dismissed, and that is deliberate rather than rude: closing
 * it would leave somebody in exactly the state the card exists to end, and
 * `must_set_password` is a column staff set, not a preference. Everything
 * behind it still works - this sits over the page, it does not take it
 * away - and the only thing it asks for is a password.
 */
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { setMyFirstPassword } from '@/lib/api'
import { asset } from '@/lib/asset'

export function SetPasswordCard() {
  const { profile, refreshProfile } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [wrong, setWrong] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!profile?.must_set_password) return null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setWrong('At least 8 characters.')
    if (password !== confirm) return setWrong('Both need to match.')

    setBusy(true)
    setWrong(null)
    try {
      await setMyFirstPassword(password)
      await refreshProfile()
    } catch (error) {
      setWrong(error instanceof Error ? error.message : 'That did not go through.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={save}
        className="w-full max-w-sm animate-pop-in rounded-2xl border border-ink-line bg-ink-card p-7 shadow-pop"
      >
        <img src={asset('/brand/favicon.png')} alt="" className="mx-auto h-14 w-14 rounded-2xl" />

        <h2 className="mt-4 text-center font-display text-lg text-white">
          Your account is a real one now
        </h2>

        <p className="mt-2 text-center text-sm leading-relaxed text-white/65">
          Everything you have made stays exactly where it is. Pick a password
          and you can sign back in as <span className="font-bold text-white">@{profile.username}</span>{' '}
          from anywhere, instead of only in this browser.
        </p>

        <div className="mt-5 space-y-3">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
          <Input
            label="Again"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={wrong ?? undefined}
          />
        </div>

        <Button variant="yes" type="submit" size="lg" block loading={busy} className="mt-5">
          Set it
        </Button>

        <p className="mt-3 text-center text-xs text-white/40">
          You can change your handle, and add an email, in Settings afterwards.
        </p>
      </form>
    </div>
  )
}

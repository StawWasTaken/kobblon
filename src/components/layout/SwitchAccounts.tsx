import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faCheck, faPlus, faXmark, faSpinner, faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { useAuth } from '@/hooks/useAuth'
import { forgetAccount, rememberedAccounts } from '@/lib/accounts'
import type { RememberedAccount } from '@/lib/accounts'
import { cn } from '@/lib/cn'

/** One account on this device, as a row you press to become it. */
function AccountRow({
  account, current, busy, onUse, onForget,
}: {
  account: RememberedAccount
  current: boolean
  busy: boolean
  onUse: () => void
  onForget: () => void
}) {
  return (
    <li className="group relative">
      <button
        onClick={onUse}
        disabled={busy || current}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors',
          current
            ? 'border-brand-bright/60 bg-brand/15'
            : 'border-transparent hover:border-ink-line hover:bg-ink-hover',
          busy && 'opacity-60',
        )}
      >
        <Avatar
          src={account.avatarUrl}
          name={account.displayName}
          personId={account.id}
          size="md"
          className="rounded-xl"
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">{account.displayName}</span>
          <span className="block truncate text-xs text-muted">@{account.username}</span>
        </span>

        {busy ? (
          <Glyph icon={faSpinner} className="shrink-0 animate-spin text-white/50" />
        ) : current ? (
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-space text-[11px] text-white">
            <Glyph icon={faCheck} />
          </span>
        ) : account.session ? (
          <Glyph
            icon={faArrowRight}
            className="shrink-0 text-white/25 transition-colors group-hover:text-white"
          />
        ) : (
          <span className="shrink-0 rounded-full border border-ink-line px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted">
            Password
          </span>
        )}
      </button>

      {!current && (
        <Tooltip label={`Forget ${account.displayName}`} side="left">
          <button
            onClick={onForget}
            aria-label={`Forget ${account.displayName}`}
            className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-ink-line bg-ink-card text-[10px] text-white/45 opacity-0 transition-opacity hover:text-white group-hover:opacity-100 focus:opacity-100"
          >
            <Glyph icon={faXmark} />
          </button>
        </Tooltip>
      )}
    </li>
  )
}

/**
 * The accounts you use on this device, and becoming one of them.
 *
 * Switching does not ask for anything: the session for each account is kept
 * here, so pressing a row is the whole action. A password is only ever asked
 * for when the stored session has actually expired, and it is asked for here
 * rather than by throwing you out to the login page.
 */
export function SwitchAccounts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, switchTo, signOut, signInWithName } = useAuth()
  const navigate = useNavigate()

  const [accounts, setAccounts] = useState(rememberedAccounts)
  const [busy, setBusy] = useState<string | null>(null)
  const [asking, setAsking] = useState<RememberedAccount | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setAccounts(rememberedAccounts())
    setAsking(null)
    setPassword('')
    setError(null)
  }, [open])

  useEffect(() => {
    if (asking) field.current?.focus()
  }, [asking])

  const arrive = () => {
    onClose()
    navigate('/home')
  }

  const use = async (account: RememberedAccount) => {
    setError(null)
    if (!account.session) {
      setAsking(account)
      return
    }

    setBusy(account.id)
    try {
      if (await switchTo(account)) {
        arrive()
        return
      }
      // The stored session was refused, so this one does need a password.
      setAsking(account)
      setAccounts(rememberedAccounts())
    } finally {
      setBusy(null)
    }
  }

  const sign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asking) return
    setBusy(asking.id)
    setError(null)
    try {
      await signInWithName(asking.username, password)
      setPassword('')
      arrive()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wrong password.')
    } finally {
      setBusy(null)
    }
  }

  /*
   * Adding an account steps aside rather than logging out: the account you
   * are leaving keeps its tokens, so coming back to it is one press.
   */
  const addAnother = async (path: string) => {
    onClose()
    await signOut({ keep: true })
    navigate(path)
  }

  const mine = accounts.filter((account) => account.id === profile?.id)
  const others = accounts.filter((account) => account.id !== profile?.id)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Switch Accounts"
      description="Accounts you use on this device. Switching does not ask for a password."
      size="sm"
    >
      {asking ? (
        <form onSubmit={sign} className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-ink-line bg-ink-raised p-3">
            <Avatar
              src={asking.avatarUrl}
              name={asking.displayName}
              personId={asking.id}
              size="md"
              className="rounded-xl"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{asking.displayName}</span>
              <span className="block truncate text-xs text-muted">@{asking.username}</span>
            </span>
          </div>

          <p className="text-sm leading-relaxed text-muted">
            This account has been signed out on this device, so it needs its password once more.
          </p>

          <Input
            ref={field}
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            error={error}
            required
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setAsking(null); setPassword(''); setError(null) }}
            >
              Back
            </Button>
            <Button type="submit" className="flex-1" loading={busy === asking.id}>
              Switch to {asking.displayName}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <ul className="space-y-1.5">
            {mine.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                current
                busy={false}
                onUse={() => {}}
                onForget={() => {}}
              />
            ))}

            {others.map((account) => (
              <AccountRow
                key={account.id}
                account={account}
                current={false}
                busy={busy === account.id}
                onUse={() => use(account)}
                onForget={() => {
                  forgetAccount(account.id)
                  setAccounts(rememberedAccounts())
                }}
              />
            ))}

            <li>
              <button
                onClick={() => addAnother('/login')}
                className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-ink-line p-3 text-left transition-colors hover:border-brand/60 hover:bg-ink-hover"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-ink-line bg-ink-raised text-white/60">
                  <Glyph icon={faPlus} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">Add account</span>
                  <span className="block text-xs text-muted">
                    Log in with a username, and keep this one here
                  </span>
                </span>
              </button>
            </li>
          </ul>

          <Button variant="subtle" block className="mt-4" onClick={() => addAnother('/signup')}>
            Make a new account
          </Button>
        </>
      )}
    </Dialog>
  )
}

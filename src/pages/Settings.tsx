import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCube, faRightFromBracket, faUser, faLock, faShieldHalved, faPen, faCheck, faPalette,
  faMoon, faSun, faDesktop, faLink, faHeadset, faScroll, faCircleCheck, faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { DiscordLink } from '@/components/social/DiscordLink'
import { Balance } from '@/components/money/Balance'
import { Transactions } from '@/components/money/Transactions'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAsync } from '@/hooks/useAsync'
import {
  USERNAME_CHANGE_COST, changeUsername, getStanding, listPixelTransactions, updateProfile,
   usernameHistory,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { currency } from '@/lib/currency'
import { cn } from '@/lib/cn'
import { useTitle } from '@/hooks/useTitle'
import { Avatar } from '@/components/ui/Avatar'
import { avatarOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'

/*
 * The money section is keyed rather than named, because what the currency is
 * called is not settled and is read from one place. The rest are named for
 * what they are, which does not change.
 */
type Section = 'Account info' | 'Security' | 'Connections' | 'Appearance' | 'money' | 'Safety'

const sections: { name: Section; label: string; icon: IconDefinition }[] = [
  { name: 'Account info', label: 'Account info', icon: faUser },
  { name: 'Security', label: 'Security', icon: faLock },
  { name: 'Connections', label: 'Connections', icon: faLink },
  { name: 'Appearance', label: 'Appearance', icon: faPalette },
  { name: 'money', label: currency.plural, icon: faCube },
  { name: 'Safety', label: 'Safety', icon: faShieldHalved },
]

/** A labelled line with whatever it takes to change it on the right. */
function Row({ label, value, action }: {
  label: string
  value: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <div className="truncate text-sm text-muted">{value}</div>
      </div>
      {action}
    </div>
  )
}

/* ----------------------------------------------------------- account info */

function AccountInfo() {
  const { profile, session, refreshProfile } = useAuth()
  const toast = useToast()

  const [displayName, setDisplayName] = useState('')
  const [pending, setPending] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamePending, setRenamePending] = useState(false)

  const history = useAsync(
    async () => (profile ? usernameHistory(profile.id) : []),
    [profile?.id, profile?.username],
  )

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.display_name)
  }, [profile])

  if (!profile) return <Skeleton className="h-64" />

  const affordable = profile.pixels >= USERNAME_CHANGE_COST

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      await updateProfile(profile.id, { display_name: displayName.trim() })
      await refreshProfile()
      toast('Saved.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    } finally {
      setPending(false)
    }
  }

  const rename = async () => {
    setRenamePending(true)
    try {
      const name = await changeUsername(newName.trim())
      await refreshProfile()
      history.reload()
      setRenaming(false)
      setNewName('')
      toast(`You are @${name} now.`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setRenamePending(false)
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save} className="space-y-4">
        <Card className="space-y-5 p-5 sm:p-6">
          <Input
            label="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={32}
            required
          />

          <p className="rounded-xl border border-ink-line bg-ink-raised p-3 text-xs leading-relaxed text-muted">
            Your picture, your bio and your colour are on your profile, where you can see what
            they look like while you change them.
          </p>

          <div className="flex justify-end">
            <Button type="submit" loading={pending}>Save changes</Button>
          </div>
        </Card>
      </form>

      <Card className="divide-y divide-ink-line">
        <Row
          label="Username"
          value={`@${profile.username}`}
          action={
            <Button size="sm" variant="subtle" icon={faPen} onClick={() => setRenaming(true)}>
              Change
            </Button>
          }
        />
        <Row label="Email" value={session?.user.email ?? 'Not set'} />
        {profile.birth_date && (
          <Row
            label="Birthday"
            value={new Date(profile.birth_date).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          />
        )}
        {!!history.data?.length && (
          <Row
            label="Names you have used"
            value={history.data.map((row) => `@${row.username}`).join(', ')}
          />
        )}
      </Card>

      <Dialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Change your username"
        description={`It costs ${currency.amount(USERNAME_CHANGE_COST)}, and your old names stay on your profile.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button
              loading={renamePending}
              disabled={!affordable || newName.trim().length < 3}
              onClick={rename}
            >
              Pay {currency.amount(USERNAME_CHANGE_COST)}
            </Button>
          </>
        }
      >
        <Input
          label="New username"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={16}
          placeholder={profile.username}
          hint="3 to 16 letters, numbers or underscores."
        />
        <p className={cn('mt-3 text-sm', affordable ? 'text-muted' : 'text-danger')}>
          You have {currency.amount(profile.pixels)}.
          {!affordable && ` You need ${USERNAME_CHANGE_COST}.`}
        </p>
      </Dialog>
    </div>
  )
}

/* --------------------------------------------------------------- security */

function Security() {
  const { signOut } = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)

  const change = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) { toast('Use at least 8 characters.', 'error'); return }
    if (password !== confirm) { toast('The two do not match.', 'error'); return }
    setPending(true)
    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)
    if (error) { toast(error.message, 'error'); return }
    setPassword('')
    setConfirm('')
    toast('Password changed.', 'success')
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-extrabold">Password</h2>
        <form onSubmit={change} className="mt-4 space-y-4">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {password.length > 0 && (
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              icon={password && password === confirm ? faCheck : undefined}
            />
          )}
          <div className="flex justify-end">
            <Button type="submit" loading={pending} disabled={!password}>Change password</Button>
          </div>
        </form>
      </Card>

      <Card className="divide-y divide-ink-line">
        <Row
          label="Log out"
          value="Ends this session on this device."
          action={
            <Button variant="subtle" icon={faRightFromBracket} onClick={() => signOut()}>Log out</Button>
          }
        />
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------- appearance */

function Appearance() {
  const { theme, setTheme } = useTheme()

  const modes = [
    { value: 'dark' as const, label: 'Dark', icon: faMoon, note: 'The way Kobblon is built.' },
    { value: 'light' as const, label: 'Light', icon: faSun, note: 'The same interface in daylight.' },
    {
      value: 'system' as const,
      label: 'System',
      icon: faDesktop,
      note: 'Follows whatever this machine is set to.',
    },
  ]

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-lg font-extrabold">Mode</h2>
      <p className="mt-0.5 text-sm text-muted">
        Kept on this device, so your other machines are not affected.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {modes.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setTheme(mode.value)}
            aria-pressed={theme === mode.value}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors',
              theme === mode.value
                ? 'border-brand-bright bg-brand/15'
                : 'border-ink-line bg-ink-raised hover:bg-ink-hover',
            )}
          >
            <span
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                mode.value === 'dark'
                  ? 'bg-[#101012] text-white'
                  : mode.value === 'light'
                    ? 'bg-[#f2f3f7] text-[#101012]'
                    : 'bg-gradient-to-br from-[#101012] to-[#f2f3f7] text-white',
              )}
            >
              <FontAwesomeIcon icon={mode.icon} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-bold">{mode.label}</span>
              <span className="block text-xs text-muted">{mode.note}</span>
            </span>
            {theme === mode.value && (
              <FontAwesomeIcon icon={faCheck} className="ml-auto text-sm text-link" />
            )}
          </button>
        ))}
      </div>
    </Card>
  )
}

/* --------------------------------------------------------------- currency */

function Money() {
  const { profile } = useAuth()
  const ledger = useAsync(
    async () => (profile ? listPixelTransactions(profile.id) : []),
    [profile?.id],
  )

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-ink-line px-5 py-4">
        <Balance amount={profile?.pixels ?? 0} size="lg" />
      </div>

      <Transactions rows={ledger.data} loading={ledger.loading} />
    </Card>
  )
}

/* ----------------------------------------------------------------- safety */

function Safety() {
  const standing = useAsync(async () => getStanding(), [])
  const level = standing.data?.level ?? 'clear'
  const clear = level === 'clear'

  return (
    <div className="space-y-4">
      {/* Where this account stands, said here rather than only on its own
          page, because this is where people come looking for it. */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span
            className={cn(
              'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border',
              clear
                ? 'border-space/40 bg-space/10 text-space-bright'
                : 'border-amber-400/40 bg-amber-400/10 text-amber-300',
            )}
          >
            <FontAwesomeIcon icon={clear ? faCircleCheck : faTriangleExclamation} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-extrabold">Where you stand</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted">
              {standing.loading
                ? 'Checking.'
                : standing.data?.headline ?? 'Nothing on record. Carry on.'}
            </p>
          </div>
          <Button size="sm" variant="subtle" to="/standing">Open</Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/support"
          className="flex items-start gap-3 rounded-2xl border border-ink-line bg-ink-card p-5 transition-colors hover:bg-ink-hover"
        >
          <FontAwesomeIcon icon={faHeadset} className="mt-1 text-brand-bright" />
          <span className="min-w-0">
            <span className="block font-bold">Write to us</span>
            <span className="mt-0.5 block text-sm leading-relaxed text-muted">
              A ticket goes to a person, and the reply lands in your inbox.
            </span>
          </span>
        </Link>
        <Link
          to="/policies"
          className="flex items-start gap-3 rounded-2xl border border-ink-line bg-ink-card p-5 transition-colors hover:bg-ink-hover"
        >
          <FontAwesomeIcon icon={faScroll} className="mt-1 text-brand-bright" />
          <span className="min-w-0">
            <span className="block font-bold">The rules</span>
            <span className="mt-0.5 block text-sm leading-relaxed text-muted">
              Every policy, each with the day its wording last changed.
            </span>
          </span>
        </Link>
      </div>

      <Card className="space-y-3 p-5 text-sm leading-relaxed text-white/65">
        <p>
          Kobblon is for people aged 15 and over. Report anything that should not be here
          using the flag on a profile or Space. Reports go straight to moderators, and the
          person you report is not told who reported them.
        </p>
        <p>
          Harassment, threats, sexual content involving minors, spam and impersonation get
          content removed and accounts suspended. What happens, and in what order, is set out
          in{' '}
          <Link to="/policies/moderation" className="font-bold text-link hover:underline">
            moderation and appeals
          </Link>
          .
        </p>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------- page */

export default function Settings() {
  useTitle('Settings')
  const { profile } = useAuth()
  const [section, setSection] = useState<Section>('Account info')

  return (
    <Page width="narrow" className="space-y-6">
      {/* Whose settings these are, and the two things people come here to
          check, before any of the panels. */}
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border border-ink-line bg-ink-card p-4">
        <Avatar
          src={avatarOf(profile)}
          personId={profile?.id}
          name={profile?.display_name ?? 'You'}
          size="lg"
          className="rounded-2xl"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">Settings</h1>
          <p className="truncate text-sm text-muted">
            {profile ? `${profile.display_name} · @${profile.username}` : 'Your account'}
          </p>
        </div>
        {!!profile && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-xl border border-ink-line bg-ink-raised px-3 py-2">
              <Balance amount={profile.pixels} size="sm" label={false} />
            </span>
            <Button size="sm" variant="subtle" to={profileLink(profile)}>Your profile</Button>
          </div>
        )}
      </header>

      <div className="grid gap-6 md:grid-cols-[13rem_1fr] md:items-start">
        <nav
          aria-label="Settings sections"
          className="flex gap-1.5 overflow-x-auto rounded-xl border border-ink-line bg-ink-card p-1.5 md:sticky md:top-20 md:block md:overflow-visible kob-scroll"
        >
          {sections.map((item) => (
            <button
              key={item.name}
              onClick={() => setSection(item.name)}
              aria-current={section === item.name ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition-colors md:w-full',
                section === item.name
                  ? 'bg-brand text-white'
                  : 'text-white/65 hover:bg-ink-hover hover:text-white',
              )}
            >
              <FontAwesomeIcon icon={item.icon} className="w-4 text-xs opacity-70" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          {section === 'Account info' && <AccountInfo />}
          {section === 'Security' && <Security />}
          {section === 'Connections' && <DiscordLink />}
          {section === 'Appearance' && <Appearance />}
          {section === 'money' && <Money />}
          {section === 'Safety' && <Safety />}
        </div>
      </div>
    </Page>
  )
}

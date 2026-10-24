import { useEffect, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { Logomark } from '@/components/brand/Wordmark'
import {
  faRightFromBracket, faUser, faLock, faShieldHalved, faPen, faCheck, faPalette,
  faMoon, faSun, faDesktop, faLink, faHeadset, faScroll, faCircleCheck,
  faTriangleExclamation, faKey, faArrowUpRightFromSquare,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { BrowseRail, BrowseFrame } from '@/components/browse/BrowseRail'
import { Panel, Group, Line, Choice, PageTop } from '@/components/settings/Panel'
import { Button } from '@/components/ui/Button'
import { DiscordLink } from '@/components/social/DiscordLink'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAsync } from '@/hooks/useAsync'
import {
  USERNAME_CHANGE_COST, changeUsername, getStanding, updateProfile,
  usernameHistory,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { currency } from '@/lib/currency'
import { cn } from '@/lib/cn'
import { useTitle } from '@/hooks/useTitle'
import { Avatar } from '@/components/ui/Avatar'
import { avatarOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'
import { useAppearance } from '@/hooks/useAppearance'
import { APPEARANCES, LOOKS, type Appearance } from '@/lib/appearances'

/*
 * Settings, redrawn so it does not need redrawing.
 *
 * Staw: "i dont want it overcrowded, with too much infos, but i want it to
 * the best design ever, like a brand new design, thats so good that we dont
 * need to change it for two years".
 *
 * The two-year part is a design brief, not a compliment to chase, and what
 * it rules out is the thing settings pages always become: a page where each
 * new setting arrives in whatever shape its author felt like, so the tenth
 * one needs a redesign to fit. So every screen here is built out of four
 * shapes and only those four - `Panel`, `Group`, `Line`, `Choice`, in
 * `components/settings/Panel` - and a new setting is a new `Line`. That is
 * the whole of it.
 *
 * What was taken out, because uncrowded is a decision rather than a wish:
 *
 *   * The gradient hero. It carried an avatar, a name, a handle and a
 *     button, and said nothing the rail and the panel do not.
 *   * The always-open password form. It is two fields somebody wants about
 *     once a year, sitting open above everything else every other time, so
 *     it is a row that opens a dialog now.
 *   * The paragraph under the display name explaining where the picture and
 *     the bio live. It is a row that goes there instead - which is shorter
 *     and, unlike a paragraph, pressable.
 *   * Two of the three sentences of policy prose in Safety. What is left is
 *     the age and the fact that reports are anonymous; the rest is on the
 *     page that exists for it.
 */

type Section = 'Account' | 'Security' | 'Connections' | 'Appearance' | 'Safety'

const sections: { name: Section; icon: IconDefinition }[] = [
  { name: 'Account', icon: faUser },
  { name: 'Security', icon: faLock },
  { name: 'Connections', icon: faLink },
  { name: 'Appearance', icon: faPalette },
  { name: 'Safety', icon: faShieldHalved },
]

/* ------------------------------------------------------------------ account */

function Account() {
  const { profile, session, refreshProfile } = useAuth()
  const toast = useToast()

  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [wanted, setWanted] = useState('')
  const [paying, setPaying] = useState(false)

  const history = useAsync(
    async () => (profile ? usernameHistory(profile.id) : []),
    [profile?.id, profile?.username],
  )

  useEffect(() => {
    if (profile) setName(profile.display_name)
  }, [profile])

  if (!profile) return <Skeleton className="h-64" />

  /* The button appears when there is something to save, which is the only
     honest moment for it: a Save that is always there is always asking. */
  const changed = name.trim() !== profile.display_name && !!name.trim()
  const affordable = profile.pixels >= USERNAME_CHANGE_COST

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(profile.id, { display_name: name.trim() })
      await refreshProfile()
      toast('Saved.', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not save.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const rename = async () => {
    setPaying(true)
    try {
      const got = await changeUsername(wanted.trim())
      await refreshProfile()
      history.reload()
      setRenaming(false)
      setWanted('')
      toast(`You are @${got} now.`, 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That did not work.', 'error')
    } finally {
      setPaying(false)
    }
  }

  const born = profile.birth_date
    ? new Date(profile.birth_date).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })
    : null

  return (
    <Panel title="Account" note="What Kobblon calls you, and what it has on file.">
      <form onSubmit={save}>
        <Group>
          <div className="space-y-3 px-5 py-4">
            <div className="max-w-sm">
              <Input
                label="Display name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                required
              />
            </div>
            {changed && (
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={saving}>Save</Button>
              </div>
            )}
          </div>

          <Line
            label="Username"
            value={`@${profile.username}`}
            action={
              <Button size="sm" variant="subtle" icon={faPen} onClick={() => setRenaming(true)}>
                Change
              </Button>
            }
          />

          <Line
            label="Picture, bio and colour"
            note="Changed on your profile, where you can see them while you do it."
            to={profileLink(profile)}
          />
        </Group>
      </form>

      <Group>
        <Line label="Email" value={session?.user.email ?? 'Not set'} />
        {born && <Line label="Birthday" value={born} />}
        {!!history.data?.length && (
          <Line
            label="Names you have used"
            value={history.data.map((row) => `@${row.username}`).join(', ')}
          />
        )}
      </Group>

      <Dialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Change your username"
        description={`It costs ${currency.amount(USERNAME_CHANGE_COST)}, and your old names stay on your profile.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button
              loading={paying}
              disabled={!affordable || wanted.trim().length < 3}
              onClick={rename}
            >
              Pay {currency.amount(USERNAME_CHANGE_COST)}
            </Button>
          </>
        }
      >
        <Input
          label="New username"
          value={wanted}
          onChange={(e) => setWanted(e.target.value)}
          maxLength={16}
          placeholder={profile.username}
          hint="3 to 16 letters, numbers or underscores."
        />

        {/*
         * The names you have had, to take one back with.
         *
         * `username_history_of` has returned the whole history since 0283
         * and nothing on the site had ever offered it to anybody - so a
         * name you used to go by was yours, nobody else could take it, and
         * the only way to get it back was to type it out exactly and hope
         * you had remembered the underscores.
         *
         * It is still the same price. A name coming back has already been
         * past Kobby once, which is why `rename_username` does not screen
         * it again, but free would make a username worth nothing: claim
         * four, keep them all, swap between them for ever.
         */}
        {!!history.data?.length && (
          <div className="mt-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-muted">
              Yours already
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {history.data.map((row) => (
                <button
                  key={row.username}
                  type="button"
                  onClick={() => setWanted(row.username)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-sm font-bold transition-colors',
                    wanted === row.username
                      ? 'border-brand-bright bg-brand/15 text-brand-bright'
                      : 'border-ink-line text-muted hover:border-brand/50 hover:text-fg',
                  )}
                >
                  @{row.username}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Nobody else can take one of these. Claiming one back costs the same as any
              other change.
            </p>
          </div>
        )}
        <p className={cn('mt-3 text-sm', affordable ? 'text-muted' : 'text-danger')}>
          You have {currency.amount(profile.pixels)}.
          {!affordable && ` You need ${USERNAME_CHANGE_COST}.`}
        </p>
      </Dialog>
    </Panel>
  )
}

/* ----------------------------------------------------------------- security */

function Security() {
  const { signOut } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [saving, setSaving] = useState(false)

  const matches = password.length >= 8 && password === again

  const change = async () => {
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    setPassword('')
    setAgain('')
    setOpen(false)
    toast('Password changed.', 'success')
  }

  return (
    <Panel title="Security" note="Nothing here is shown to anybody else.">
      <Group>
        <Line
          label="Password"
          note="At least eight characters. You will stay signed in here."
          icon={faKey}
          action={<Button size="sm" variant="subtle" onClick={() => setOpen(true)}>Change</Button>}
        />
        <Line
          label="Log out"
          note="Ends this session on this device only."
          icon={faRightFromBracket}
          action={
            <Button size="sm" variant="subtle" icon={faRightFromBracket} onClick={() => signOut()}>
              Log out
            </Button>
          }
        />
      </Group>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Change your password"
        description="Eight characters or more, typed twice."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button loading={saving} disabled={!matches} onClick={change}>Change password</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="New password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {/* The second field turns up once there is something to confirm.
              Two identical empty boxes is a question asked before it has
              been answered once. */}
          {password.length > 0 && (
            <Input
              label="Type it again"
              type="password"
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              autoComplete="new-password"
              icon={matches ? faCheck : undefined}
              hint={password.length < 8 ? 'Eight characters or more.' : undefined}
            />
          )}
        </div>
      </Dialog>
    </Panel>
  )
}

/* --------------------------------------------------------------- appearance */

/** The swatch a mode is picked by: the light it puts the interface in. */
function ModeSwatch({ which, icon }: { which: 'dark' | 'light' | 'system'; icon: IconDefinition }) {
  return (
    <span
      className={cn(
        'grid h-10 w-10 place-items-center rounded-xl',
        which === 'dark' ? 'bg-[#101012] text-white'
          : which === 'light' ? 'bg-[#f2f3f7] text-[#101012]'
            : 'bg-gradient-to-br from-[#101012] to-[#f2f3f7] text-white',
      )}
    >
      <Glyph icon={icon} />
    </span>
  )
}

function Looks() {
  const { theme, setTheme } = useTheme()
  const { appearance, owned, wear } = useAppearance()
  const say = useToast()
  const [changing, setChanging] = useState<string | null>(null)

  const modes = [
    { value: 'dark' as const, label: 'Dark', icon: faMoon, note: 'The way Kobblon is built.' },
    { value: 'light' as const, label: 'Light', icon: faSun, note: 'The same interface in daylight.' },
    { value: 'system' as const, label: 'System', icon: faDesktop, note: 'Follows this machine.' },
  ]

  const put = async (which: Appearance) => {
    if (which === appearance) return
    setChanging(which)
    try {
      await wear(which)
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    } finally {
      setChanging(null)
    }
  }

  const mine = APPEARANCES.filter((one) => owned.includes(one))
  const missing = APPEARANCES.filter((one) => !owned.includes(one))

  return (
    <div className="space-y-8">
      <Panel title="Appearance" note="The mode stays on this device. The appearance travels with the account.">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {modes.map((mode) => (
            <Choice
              key={mode.value}
              on={theme === mode.value}
              onClick={() => setTheme(mode.value)}
              swatch={<ModeSwatch which={mode.value} icon={mode.icon} />}
              title={mode.label}
              note={mode.note}
            />
          ))}
        </div>
      </Panel>

      {/*
       * The appearances somebody actually has, and nothing else. One that
       * was never claimed is not drawn greyed out with a lock on it: a
       * control that cannot do anything is worse than no control, and
       * "here is a thing you cannot have" is not news for a settings page.
       * When each comes round is said instead, because that can be acted on.
       */}
      <Panel title="Theme appearances" note="Yours for good once claimed, on whatever you sign in on.">
        <div className="grid gap-2.5 sm:grid-cols-2">
          {mine.map((one) => (
            <Choice
              key={one}
              on={appearance === one}
              disabled={changing === one}
              onClick={() => void put(one)}
              swatch={
                /* The mark on its own bar colour. `data-appearance` on the
                   swatch is what makes each tile show its own appearance
                   rather than the one being worn. */
                <span
                  data-appearance={one}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-chrome"
                >
                  <Logomark className="h-6" />
                </span>
              }
              title={LOOKS[one].name}
              note={LOOKS[one].note}
            />
          ))}
        </div>

        {!!missing.length && (
          <p className="text-xs leading-relaxed text-muted">
            {missing.map((one) => LOOKS[one].when).join(' ')} A card shows up while one is
            being given away, and claiming it is the only way to keep it.
          </p>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------------------------------------------- safety */

function Safety() {
  const standing = useAsync(async () => getStanding(), [])
  const clear = (standing.data?.level ?? 'clear') === 'clear'

  return (
    <Panel title="Safety" note="Where this account stands, and how to reach a person about it.">
      <Group>
        <Line
          label="Where you stand"
          note={
            standing.loading
              ? 'Checking.'
              : standing.data?.headline ?? 'Nothing on record. Carry on.'
          }
          icon={clear ? faCircleCheck : faTriangleExclamation}
          to="/standing"
          danger={!clear}
        />
      </Group>

      <Group>
        <Line
          label="Write to us"
          note="A ticket goes to a person, and the reply lands in your inbox."
          icon={faHeadset}
          to="/support"
        />
        <Line
          label="Policies"
          note="Every policy, each with the day its wording last changed."
          icon={faScroll}
          to="/policies"
        />
        <Line
          label="Moderation and appeals"
          note="What happens when a rule is broken, and in what order."
          icon={faArrowUpRightFromSquare}
          to="/policies/moderation"
        />
      </Group>

      {/* Two sentences. The rest of it is on the pages above, which exist
          for exactly this and are kept up to date in one place. */}
      <p className="px-1 text-xs leading-relaxed text-muted">
        Kobblon is for people aged 15 and over. Reports go straight to moderators, and the
        person you report is never told who reported them.
      </p>
    </Panel>
  )
}

/* --------------------------------------------------------------------- page */

export default function Settings() {
  useTitle('Settings')
  const { profile } = useAuth()
  const [section, setSection] = useState<Section>('Account')

  return (
    <Page className="space-y-6">
      {/*
       * One line, where there was a gradient panel with an avatar, a name,
       * a handle and a button in it. The avatar is here because a settings
       * page should say whose account is open - a shared machine is the
       * normal case for this platform - and nothing else is, because the
       * rail says what the page holds and the panel says where you are.
       */}
      <PageTop
        title="Settings"
        note={profile ? `@${profile.username}` : 'Your account'}
        aside={
          <Avatar
            src={avatarOf(profile)}
            personId={profile?.id}
            name={profile?.display_name ?? 'You'}
            size="md"
            className="rounded-xl"
          />
        }
      />

      <BrowseFrame
        rail={
          <BrowseRail
            label="Settings sections"
            items={sections.map((one) => ({ value: one.name, label: one.name, icon: one.icon }))}
            value={section}
            onChange={setSection}
          />
        }
      >
        {/*
         * Capped at the width a form is read at, and left where the rail
         * puts it rather than centred in the slack: a panel that slides
         * sideways as the window grows is a panel nobody can aim at twice.
         */}
        {/* Every panel says its own name and what it is for, so there is
            nothing to repeat here for the phone, where the rail has been
            scrolled past by the time anything is read. */}
        <div className="min-w-0 max-w-2xl">
          {section === 'Account' && <Account />}
          {section === 'Security' && <Security />}
          {section === 'Connections' && (
            <Panel title="Connections" note="Other places this account is tied to.">
              <DiscordLink />
            </Panel>
          )}
          {section === 'Appearance' && <Looks />}
          {section === 'Safety' && <Safety />}
        </div>
      </BrowseFrame>
    </Page>
  )
}

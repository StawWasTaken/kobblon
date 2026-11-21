import { useEffect, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { Switch } from '@/components/ui/Switch'
import { Logomark } from '@/components/brand/Wordmark'
import {
  faRightFromBracket, faUser, faLock, faShieldHalved, faPen, faCheck, faPalette,
  faMoon, faSun, faDesktop, faLink, faHeadset, faScroll, faCircleCheck,
  faTriangleExclamation, faKey, faArrowUpRightFromSquare, faClock, faEye,
  faAt, faEnvelope, faCakeCandles, faIdBadge, faImage,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { BrowseFrame } from '@/components/browse/BrowseRail'
import {
  Panel, Group, Line, Choice, PageTop, AccountCard, SettingsRail,
} from '@/components/settings/Panel'
import { Button } from '@/components/ui/Button'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { NameMarks } from '@/components/brand/Verified'
import { formatCount } from '@/lib/format'
import { DiscordLink } from '@/components/social/DiscordLink'
import { Input } from '@/components/ui/Input'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/States'
import { GenderPicker } from '@/components/auth/GenderPicker'
import type { Gender } from '@/components/auth/GenderPicker'
import type { Profile } from '@/types/db'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { TEXT_SIZES, useTextSize, type TextSize } from '@/hooks/useTextSize'
import { useAsync } from '@/hooks/useAsync'
import {
  USERNAME_CHANGE_COST, changeUsername, getStanding, updateProfile, usernameChangeState,
  usernameHistory,
  setPrivacy,
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

type Section = 'Account' | 'Security' | 'Privacy' | 'Connections' | 'Appearance' | 'Safety'

/*
 * Each room says what is in it.
 *
 * Staw asked for this page the way the World page went: a console's
 * settings rather than a list of words. A console's list is the six words
 * **and a line each**, because "Privacy" on its own does not tell anybody
 * whether who-can-message-me is behind it, and the cost of finding out is
 * a press and a page.
 */
const sections: { name: Section; icon: IconDefinition; note: string }[] = [
  { name: 'Account', icon: faUser, note: 'Your name, your handle, your age.' },
  { name: 'Security', icon: faLock, note: 'Password, email, signing out.' },
  { name: 'Privacy', icon: faEye, note: 'Who may find you, write to you, see you.' },
  { name: 'Connections', icon: faLink, note: 'Discord, and who sees it.' },
  { name: 'Appearance', icon: faPalette, note: 'Light or dark, and how big.' },
  { name: 'Safety', icon: faShieldHalved, note: 'Reports, standing, the rules.' },
]

/* ------------------------------------------------------------------ account */

function Account() {
  const { profile, session, refreshProfile } = useAuth()
  const toast = useToast()

  const [name, setName] = useState('')
  const [gender, setGender] = useState<Gender>('')
  const [saving, setSaving] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [wanted, setWanted] = useState('')
  const [paying, setPaying] = useState(false)

  const history = useAsync(
    async () => (profile ? usernameHistory(profile.id) : []),
    [profile?.id, profile?.username],
  )

  /* What it costs and whether today is allowed, both from the server. */
  const renameState = useAsync(
    async () => (profile ? usernameChangeState() : null),
    [profile?.id, profile?.username],
  )

  useEffect(() => {
    if (profile) {
      setName(profile.display_name)
      setGender((profile.gender ?? '') as Gender)
    }
  }, [profile])

  if (!profile) return <Skeleton className="h-64" />

  /* The button appears when there is something to save, which is the only
     honest moment for it: a Save that is always there is always asking. */
  const changed = (name.trim() !== profile.display_name && !!name.trim())
    || gender !== ((profile.gender ?? '') as Gender)
  const cost = renameState.data?.cost ?? USERNAME_CHANGE_COST
  const affordable = profile.pixels >= cost
  /*
   * The wait comes from the server, not from a date worked out here.
   * Somebody whose machine is an hour fast would otherwise be shown an
   * enabled button and then refused by the database, which reads as the
   * site being broken rather than as a rule.
   */
  const waiting = !!renameState.data?.waiting
  const freeAt = renameState.data?.nextAt
    ? new Date(renameState.data.nextAt).toLocaleString(undefined, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
    : null

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(profile.id, {
        display_name: name.trim(),
        /* Null rather than an empty string: the column's check allows the
           three answers and nothing else, and "" is not one of them. */
        gender: (gender || null) as Profile['gender'],
      })
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
      /* The wait starts now, and the dialog is closed with the day still
         on it - so the next time it opens it has to already know. */
      renameState.reload()
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
    <Panel title="Account">
      {/* Whose account is open, which a shared machine makes worth saying,
          and the one door out of here to the page it is all drawn on. */}
      <Group>
        <Line
          label={profile.display_name}
          value={`@${profile.username}`}
          to={profileLink(profile)}
          action={
            <Avatar
              src={avatarOf(profile)}
              personId={profile.id}
              name={profile.display_name}
              size="md"
              className="rounded-xl"
            />
          }
        />
      </Group>

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
            {/*
              * The signup answer, changeable: a girl's Newbie wears the
              * Waisted Torso, and a question you can only answer once is a
              * question half the people answer wrongly. The picker draws
              * its own label.
              */}
            <div className="max-w-sm">
              <GenderPicker value={gender} onChange={setGender} />
            </div>

            {changed && (
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={saving}>Save</Button>
              </div>
            )}
          </div>

          <Line
            label="Username"
            icon={faAt}
            value={`@${profile.username}`}
            action={
              <Button size="sm" variant="subtle" icon={faPen} onClick={() => setRenaming(true)}>
                Change
              </Button>
            }
          />

          <Line
            label="Picture, bio and colour"
            icon={faImage}
            to={profileLink(profile)}
          />
        </Group>
      </form>

      <Group>
        <Line label="Email" icon={faEnvelope} value={session?.user.email ?? 'Not set'} />
        {born && <Line label="Birthday" icon={faCakeCandles} value={born} />}
        {!!history.data?.length && (
          <Line
            label="Names you have used"
            icon={faIdBadge}
            value={history.data.map((row) => `@${row.username}`).join(', ')}
          />
        )}
      </Group>

      <Dialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Change your username"
        description="Once a day. Your old names stay yours."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
            <Button
              loading={paying}
              disabled={!affordable || waiting || wanted.trim().length < 3}
              onClick={rename}
            >
              Pay {currency.amount(cost)}
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
          hint="3-16 letters, numbers or underscores"
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
                    'rounded-lg border-2 px-2.5 py-1 text-sm font-bold transition-colors',
                    wanted === row.username
                      ? 'border-brand-bright bg-brand/15 text-brand-bright'
                      : 'border-ink-line text-muted hover:border-brand/50 hover:text-fg',
                  )}
                >
                  @{row.username}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* The wait first, because it is the one that cannot be solved by
            going and earning something. */}
        {waiting && (
          <p className="mt-3 flex items-start gap-2 rounded-xl border-2 border-b-4 border-warn/40 bg-warn/10 p-3 text-sm text-warn-bright">
            <Glyph icon={faClock} className="mt-0.5 shrink-0" />
            <span>
              You changed your name less than a day ago.
              {freeAt ? ` You can change it again on ${freeAt}.` : ' Try again tomorrow.'}
            </span>
          </p>
        )}
        {/* Only when it is in the way: a balance printed under every
            dialog is a number nobody came to read. */}
        {!affordable && (
          <p className="mt-3 text-sm text-danger">
            You have {currency.amount(profile.pixels)}.
          </p>
        )}
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
    <Panel title="Security">
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

/**
 * The swatch a size is picked by: the same two letters at the size that
 * option puts them at.
 *
 * Drawn in pixels rather than in `rem`, which is the whole point of it -
 * every other size on the page is relative, so on Comfortable all three
 * tiles would grow together and the row would say nothing. These are the
 * three sizes themselves, side by side, whichever one is on.
 */
function SizeSwatch({ px }: { px: number }) {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-raised font-display font-extrabold leading-none text-white">
      <span style={{ fontSize: `${px}px` }}>Aa</span>
    </span>
  )
}

/* Exported for `tools/site/appearance-preview.html`, which mounts it with
 * nothing round it: the one place a mark or a tile that needs a provider
 * shows up as a blank panel before the Workspace finds it. */
export function Looks() {
  const { theme, setTheme } = useTheme()
  const { size, setSize } = useTextSize()
  const { appearance, owned, wear } = useAppearance()
  const say = useToast()
  const [changing, setChanging] = useState<string | null>(null)

  const modes = [
    { value: 'dark' as const, label: 'Dark', icon: faMoon, note: 'The way Kobblon is built.' },
    { value: 'light' as const, label: 'Light', icon: faSun, note: 'The same interface in daylight.' },
    { value: 'system' as const, label: 'System', icon: faDesktop, note: 'Follows this machine.' },
  ]

  const sizes: Record<TextSize, { label: string; note: string; px: number }> = {
    minimalist: { label: 'Minimalist', note: 'Smaller text, less room taken.', px: 12 },
    default: { label: 'Default', note: 'The way Kobblon is built.', px: 15 },
    comfortable: { label: 'Comfortable', note: 'Bigger text, more room to read.', px: 18 },
  }

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
      <Panel title="Appearance">
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
       * One lever, not two. Kobblon's type scale and its spacing scale are
       * both in `rem`, so the size of the words and the room around them
       * are the same number - a "text size" that left the padding where it
       * was would be bigger words in a box built for smaller ones, which is
       * crowding rather than comfort.
       */}
      <Panel title="Size">
        <div className="grid gap-2.5 sm:grid-cols-3">
          {TEXT_SIZES.map((one) => (
            <Choice
              key={one}
              on={size === one}
              onClick={() => setSize(one)}
              swatch={<SizeSwatch px={sizes[one].px} />}
              title={sizes[one].label}
              note={sizes[one].note}
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
      <Panel title="Theme appearances">
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
          <p className="text-xs text-muted">{missing.map((one) => LOOKS[one].when).join(' ')}</p>
        )}
      </Panel>
    </div>
  )
}


/* ------------------------------------------------------------------ privacy */

/**
 * Who sees what, in one place.
 *
 * Four answers of the same shape - what you are thinking, your Discord
 * handle, which World you are in, and who may walk into it after you - and
 * every one of them starts at friends. A default that opens somebody up is
 * a default nobody chose.
 *
 * None of these is enforced here. The thought is a table with a policy on
 * it; where you are and who may follow you are decided inside
 * `where_they_are`, which is the one door that hands either out; the
 * handle has been server-side since 0071. This page only says what the
 * answer is.
 */
function Privacy() {
  const { profile, refreshProfile } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  if (!profile) return null

  const save = async (patch: Parameters<typeof setPrivacy>[1]) => {
    setBusy(true)
    try {
      await setPrivacy(profile.id, patch)
      await refreshProfile()
    } catch {
      toast('That did not save.', 'error')
    } finally {
      setBusy(false)
    }
  }

  /** On is everyone, off is friends. One shape for all four. */
  const row = (
    label: string,
    value: string | null | undefined,
    set: (next: 'everyone' | 'friends') => void,
  ) => (
    <Switch
      key={label}
      label={label}
      note={value === 'nobody' ? 'Nobody' : value === 'everyone' ? 'Everyone' : 'Friends only'}
      on={value === 'everyone'}
      busy={busy}
      onChange={(on) => set(on ? 'everyone' : 'friends')}
    />
  )

  return (
    <Panel title="Privacy">
      <div className="space-y-2">
        {row('Your thought', profile.thought_privacy, (next) => void save({ thought_privacy: next }))}
        {row('The World you are in', profile.where_privacy, (next) => void save({ where_privacy: next }))}
        {row('Joining you', profile.join_privacy, (next) => void save({ join_privacy: next }))}
        {profile.discord_id
          && row('Your Discord handle', profile.discord_visibility, (next) => void save({ discord_visibility: next }))}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------- safety */


function Safety() {
  const standing = useAsync(async () => getStanding(), [])
  const clear = (standing.data?.level ?? 'clear') === 'clear'

  return (
    <Panel title="Safety">
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
          icon={faHeadset}
          to="/support"
        />
        <Line
          label="Policies"
          icon={faScroll}
          to="/policies"
        />
        <Line
          label="Moderation and appeals"
          icon={faArrowUpRightFromSquare}
          to="/policies/moderation"
        />
      </Group>

    </Panel>
  )
}

/* --------------------------------------------------------------------- page */

export default function Settings() {
  useTitle('Settings')
  const [section, setSection] = useState<Section>('Account')
  const { profile } = useAuth()

  return (
    <Page className="space-y-5">
      <PageTop title="Settings" />

      {/*
       * The account this page is about, before anything it can change.
       *
       * A shared computer is the normal case on this platform, so "whose
       * settings are these" is the first question rather than a detail -
       * and the three facts beside the name are the ones somebody checks
       * here anyway: when they joined, what they are holding, and whether
       * the account is a real one yet.
       */}
      {profile && (
        <AccountCard
          face={<PersonAvatar person={profile} size="lg" />}
          name={profile.display_name}
          marks={<NameMarks person={profile} className="text-base" />}
          handle={profile.username}
          facts={[
            { label: 'Brix', value: formatCount(profile.pixels ?? 0) },
            {
              label: 'Here since',
              value: new Date(profile.created_at).toLocaleDateString('en-GB', {
                month: 'short', year: 'numeric',
              }),
            },
          ]}
          action={
            <Button to={`/u/${profile.username}`} variant="subtle" size="sm">
              Your page
            </Button>
          }
        />
      )}

      <BrowseFrame
        rail={
          <SettingsRail
            label="Settings sections"
            items={sections.map((one) => ({
              value: one.name,
              label: one.name,
              note: one.note,
              icon: one.icon,
            }))}
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
        <div className="min-w-0 max-w-2xl">
          {section === 'Account' && <Account />}
          {section === 'Security' && <Security />}
          {section === 'Privacy' && <Privacy />}
          {section === 'Connections' && (
            <Panel title="Connections" note="Other accounts you have said are yours.">
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

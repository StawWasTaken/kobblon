import { useEffect, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { Switch } from '@/components/ui/Switch'
import { Tooltip } from '@/components/ui/Tooltip'
import { Logomark } from '@/components/brand/Wordmark'
import {
  faRightFromBracket, faUser, faLock, faShieldHalved, faPen, faCheck, faPalette,
  faMoon, faSun, faDesktop, faLink, faHeadset, faScroll, faCircleCheck,
  faTriangleExclamation, faKey, faArrowUpRightFromSquare, faClock, faEye,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Page } from '@/components/layout/AppShell'
import { BrowseFrame } from '@/components/browse/BrowseRail'
import {
  PageTop, Title, Head, SettingRow, Field, Pick, SettingsRail,
} from '@/components/settings/Panel'
import { Button } from '@/components/ui/Button'
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

const sections: { name: Section; icon: IconDefinition }[] = [
  { name: 'Account', icon: faUser },
  { name: 'Security', icon: faLock },
  { name: 'Privacy', icon: faEye },
  { name: 'Connections', icon: faLink },
  { name: 'Appearance', icon: faPalette },
  { name: 'Safety', icon: faShieldHalved },
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
    <>
      <Title icon={faUser}>Account</Title>

      <Head>Who you are</Head>
      <form onSubmit={save}>
        <Field label="Display name">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 max-w-sm flex-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                required
              />
            </div>
            {changed && <Button type="submit" size="sm" loading={saving}>Save</Button>}
          </div>
        </Field>

        <Field label="Username">
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-sm text-white/70">@{profile.username}</p>
            <Button size="sm" variant="subtle" icon={faPen} onClick={() => setRenaming(true)}>
              Change
            </Button>
          </div>
        </Field>

        {/*
          * The signup answer, changeable: a girl's Newbie wears the
          * Waisted Torso, and a question you can only answer once is a
          * question half the people answer wrongly.
          */}
        <Field label="Gender">
          <div className="max-w-md">
            <GenderPicker bare value={gender} onChange={setGender} />
          </div>
        </Field>
      </form>

      <Head>On record</Head>
      <SettingRow label="Email" value={session?.user.email ?? 'Not set'} />
      {born && <SettingRow label="Birthday" value={born} />}
      {!!history.data?.length && (
        <SettingRow
          label="Names you have used"
          value={history.data.map((row) => `@${row.username}`).join(', ')}
        />
      )}
      <SettingRow
        label="Picture, bio and colour"
        note="All three live on your page."
        to={profileLink(profile)}
      />

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
    </>
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
    <>
      <Title icon={faLock}>Security</Title>

      <Head>Getting in</Head>
      <SettingRow
        label="Password"
        note="At least eight characters. You will stay signed in here."
        action={<Button size="sm" variant="subtle" icon={faKey} onClick={() => setOpen(true)}>Change</Button>}
      />

      <Head>This device</Head>
      <SettingRow
        label="Log out"
        note="Ends this session on this device only."
        action={
          <Button size="sm" variant="subtle" icon={faRightFromBracket} onClick={() => signOut()}>
            Log out
          </Button>
        }
      />

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
    </>
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
    <>
      <Title icon={faPalette}>Appearance</Title>

      <Head>Light or dark</Head>
      <div className="grid gap-2.5 py-2 sm:grid-cols-3">
        {modes.map((mode) => (
          <Pick
            key={mode.value}
            on={theme === mode.value}
            onClick={() => setTheme(mode.value)}
            swatch={<ModeSwatch which={mode.value} icon={mode.icon} />}
            title={mode.label}
            note={mode.note}
          />
        ))}
      </div>

      {/*
       * One lever, not two. Kobblon's type scale and its spacing scale are
       * both in `rem`, so the size of the words and the room around them
       * are the same number - a "text size" that left the padding where it
       * was would be bigger words in a box built for smaller ones, which is
       * crowding rather than comfort.
       */}
      <Head>Size</Head>
      <div className="grid gap-2.5 py-2 sm:grid-cols-3">
        {TEXT_SIZES.map((one) => (
          <Pick
            key={one}
            on={size === one}
            onClick={() => setSize(one)}
            swatch={<SizeSwatch px={sizes[one].px} />}
            title={sizes[one].label}
            note={sizes[one].note}
          />
        ))}
      </div>

      {/*
       * The appearances somebody actually has, and nothing else. One that
       * was never claimed is not drawn greyed out with a lock on it: a
       * control that cannot do anything is worse than no control, and
       * "here is a thing you cannot have" is not news for a settings page.
       * When each comes round is said instead, because that can be acted on.
       *
       * Drawn as tiles rather than as rows. Staw: there will be a lot of
       * these, and a shelf of marks takes five across where a rectangle
       * with a sentence in it took two. The sentence is the tooltip.
       */}
      <Head>Theme appearances</Head>
      <div className="grid grid-cols-3 gap-2.5 py-2 sm:grid-cols-5">
        {mine.map((one) => (
          <Tooltip key={one} label={LOOKS[one].note} side="top">
            <Pick
              stack
              on={appearance === one}
              disabled={changing === one}
              onClick={() => void put(one)}
              title={LOOKS[one].name}
              swatch={
                /* The mark on its own bar colour. `data-appearance` on the
                   swatch is what makes each tile show its own appearance
                   rather than the one being worn. */
                <span
                  data-appearance={one}
                  className="grid h-12 w-12 place-items-center rounded-xl border-2 border-ink-line bg-chrome"
                >
                  <Logomark className="h-7" />
                </span>
              }
            />
          </Tooltip>
        ))}
      </div>

      {!!missing.length && (
        <p className="px-1 pb-2 text-xs text-muted">
          {missing.map((one) => LOOKS[one].when).join(' ')}
        </p>
      )}
    </>
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
    <>
      <Title icon={faEye}>Privacy</Title>
      <Head>Everyone, or friends only</Head>
      <div className="space-y-2 py-2">
        {row('Your thought', profile.thought_privacy, (next) => void save({ thought_privacy: next }))}
        {row('The World you are in', profile.where_privacy, (next) => void save({ where_privacy: next }))}
        {row('Joining you', profile.join_privacy, (next) => void save({ join_privacy: next }))}
        {profile.discord_id
          && row('Your Discord handle', profile.discord_visibility, (next) => void save({ discord_visibility: next }))}
      </div>
    </>
  )
}

/* ------------------------------------------------------------------- safety */


function Safety() {
  const standing = useAsync(async () => getStanding(), [])
  const clear = (standing.data?.level ?? 'clear') === 'clear'

  return (
    <>
      <Title icon={faShieldHalved}>Safety</Title>

      <Head>Your standing</Head>
      <SettingRow
        label={standing.data?.headline ?? (standing.loading ? 'Checking' : 'Nothing on record')}
        note={clear ? 'No warnings, no suspensions. Carry on.' : 'Press for what it means and what to do.'}
        value={
          <Glyph
            icon={clear ? faCircleCheck : faTriangleExclamation}
            className={clear ? 'text-space' : 'text-danger'}
          />
        }
        to="/standing"
        danger={!clear}
      />

      <Head>If something is wrong</Head>
      <SettingRow
        label="Write to us"
        note="Reports are anonymous to the person reported."
        value={<Glyph icon={faHeadset} className="text-muted" />}
        to="/support"
      />
      <SettingRow
        label="Policies"
        value={<Glyph icon={faScroll} className="text-muted" />}
        to="/policies"
      />
      <SettingRow
        label="Moderation and appeals"
        value={<Glyph icon={faArrowUpRightFromSquare} className="text-muted" />}
        to="/policies/moderation"
      />
    </>
  )
}

export default function Settings() {
  useTitle('Settings')
  const [section, setSection] = useState<Section>('Account')

  return (
    <Page className="space-y-5">
      <PageTop title="Settings" />

      <BrowseFrame
        rail={
          <SettingsRail
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
        <div className="min-w-0 max-w-3xl">
          {section === 'Account' && <Account />}
          {section === 'Security' && <Security />}
          {section === 'Privacy' && <Privacy />}
          {section === 'Connections' && (
            <>
              <Title icon={faLink}>Connections</Title>
              <Head>Linked</Head>
              <DiscordLink />
            </>
          )}
          {section === 'Appearance' && <Looks />}
          {section === 'Safety' && <Safety />}
        </div>
      </BrowseFrame>
    </Page>
  )
}

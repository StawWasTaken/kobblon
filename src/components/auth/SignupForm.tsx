import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Reveal } from '@/components/ui/Reveal'
import { BirthdayPicker, birthdayToDate, emptyBirthday } from './BirthdayPicker'
import type { Birthday } from './BirthdayPicker'
import { GenderPicker } from './GenderPicker'
import type { Gender } from './GenderPicker'
import { useAuth } from '@/hooks/useAuth'
import { checkUsername } from '@/lib/api'
import { isOldEnough, MINIMUM_AGE } from '@/lib/age'

type Errors = Partial<Record<'birthday' | 'username' | 'displayName' | 'email'
  | 'password' | 'confirm' | 'form', string>>

/*
 * The same shape as a username, and the same shape the column now enforces.
 *
 * Staw: "no spaces, no '-', only normal text, numbers, '_' allowed and
 * thats it". Here so somebody is told while they are typing rather than by
 * a constraint violation on submit; the rule itself is the check constraint
 * on `profiles.display_name`, because a rule that only exists in a browser
 * is not a rule.
 */
const NAME_SHAPE = /^[A-Za-z0-9_]{1,32}$/
const NAME_SAID = 'Letters, numbers and underscores. No spaces.'

/**
 * The same form does both jobs. A guest keeps the account they are already
 * signed in with, so nothing they made is thrown away when they decide to
 * stay; anybody else gets a new one.
 */
export function SignupForm({
  onSent, claiming, onClaimed,
}: {
  onSent: (email: string) => void
  claiming?: boolean
  onClaimed?: () => void
}) {
  const { signUp, signUpWithoutEmail, claimAccount } = useAuth()

  const [birthday, setBirthday] = useState<Birthday>(emptyBirthday)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [displayNameTouched, setDisplayNameTouched] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [gender, setGender] = useState<Gender>('')
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'ok' | 'bad'>('idle')

  // The display name starts as a copy of the username and follows it until
  // the person edits it themselves.
  useEffect(() => {
    if (!displayNameTouched) setDisplayName(username)
  }, [username, displayNameTouched])

  // Names are checked while they are typed, so a taken or blocked one is
  // caught here rather than at the end of the form.
  useEffect(() => {
    if (username.length < 3) {
      setUsernameState('idle')
      return
    }
    setUsernameState('checking')
    const timer = window.setTimeout(async () => {
      try {
        const verdict = await checkUsername(username)
        setUsernameState(verdict.ok ? 'ok' : 'bad')
        setErrors((all) => ({ ...all, username: verdict.ok ? undefined : verdict.reason ?? undefined }))
      } catch {
        setUsernameState('idle')
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [username])

  const validate = () => {
    const found: Errors = {}
    const birthDate = birthdayToDate(birthday)

    if (!birthDate) found.birthday = 'Pick your birthday.'
    else if (!isOldEnough(birthDate)) found.birthday = `You need to be ${MINIMUM_AGE} or over to use Kobblon.`

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      found.username = 'Letters, numbers and underscores. 3 to 20 characters.'
    } else if (usernameState === 'bad') {
      found.username = errors.username ?? 'Pick a different username.'
    }
    if (displayName.trim() && !NAME_SHAPE.test(displayName.trim())) {
      found.displayName = NAME_SAID
    }
    if (password.length < 8) found.password = 'At least 8 characters.'
    else if (password !== confirm) found.confirm = 'Both passwords need to match.'

    setErrors(found)
    return Object.keys(found).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setPending(true)
    try {
      const details = {
        email,
        password,
        username,
        displayName: displayName.trim() || username,
        /*
         * Nothing. A profile picture is a shot of the avatar now, drawn the
         * first time somebody looks at themselves - so signing up is a name,
         * an email and a password, and the picture is something they get by
         * having a body rather than something they have to find a file for.
         */
        avatarFile: null,
        birthDate: birthdayToDate(birthday),
        gender,
      }

      if (claiming) {
        await claimAccount(details)
        onClaimed?.()
      } else if (email.trim()) {
        await signUp(details)
        onSent(email)
      } else {
        /*
         * No address, so no confirmation to wait for: the account is made
         * behind the service role and this tab is signed in by the time
         * the call comes back. `onSent('')` is what the page reads as
         * "there is nothing to go and check".
         */
        await signUpWithoutEmail(details)
        onSent('')
      }
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'That did not go through. Try again.' })
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5" noValidate>
      <BirthdayPicker value={birthday} onChange={setBirthday} error={errors.birthday} />

      <Input
        label="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        maxLength={20}
        error={errors.username}
        hint={
          usernameState === 'checking'
            ? 'Checking that name'
            : usernameState === 'ok'
              ? 'That one is free'
              : '3 to 20 characters, no spaces'
        }
      />

      <Reveal when={username.length > 0}>
        <Input
          label="Display name"
          labelNote="what people see, you can change it"
          value={displayName}
          onChange={(e) => {
            setDisplayNameTouched(true)
            setDisplayName(e.target.value)
          }}
          maxLength={32}
          error={errors.displayName}
        />
      </Reveal>

      {/*
        * Optional, and said so on the label rather than in a note
        * underneath, because a field that looks required is required.
        *
        * Staw: "make that emails are not required to make a kobblon
        * account". What an address is actually for is getting back in when
        * a password is forgotten, so that is what the hint says - there is
        * no other way back, and somebody deciding to skip it should be
        * deciding that rather than finding out later.
        */}
      <Input
        label="Email"
        labelNote="optional"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        error={errors.email}
        hint="Without one there is no way to reset a forgotten password."
      />

      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
        error={errors.password}
        placeholder="At least 8 characters"
      />

      <Reveal when={password.length > 0}>
        <Input
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          error={errors.confirm}
        />
      </Reveal>

      <GenderPicker value={gender} onChange={setGender} />

      {errors.form && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {errors.form}
        </p>
      )}

      <Button variant="yes" type="submit" size="lg" block loading={pending}>
        {claiming ? 'Keep this account' : 'Sign up'}
      </Button>

      <p className="text-center text-[11px] leading-relaxed text-muted">
        By carrying on you agree to our{' '}
        <Link to="/policies/terms" className="font-semibold text-link hover:underline">Terms of Service</Link>
        {' '}and{' '}
        <Link to="/policies/guidelines" className="font-semibold text-link hover:underline">Community Guidelines</Link>.
      </p>
    </form>
  )
}

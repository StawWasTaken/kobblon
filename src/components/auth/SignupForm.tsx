import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { policyUrl } from '@/lib/links'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Reveal } from '@/components/ui/Reveal'
import { BirthdayPicker, birthdayToDate, emptyBirthday } from './BirthdayPicker'
import type { Birthday } from './BirthdayPicker'
import { GenderPicker } from './GenderPicker'
import type { Gender } from './GenderPicker'
import { useMaybeAuth } from '@/hooks/useAuth'
import {
  signUpWithEmail, signUpWithoutEmailAddress, claimAccount as claimTheAccount,
} from '@/lib/signup'
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
 * One of the two policy links, wherever this form has been mounted.
 *
 * On the site it is a `<Link>`. In an application there is no router, so a
 * `<Link>` throws and takes the panel down - the third time that has
 * happened here - and the address bar it would change does not exist
 * either. So: whatever `onPolicy` does, else an ordinary address at
 * kobblon.com opened in a new tab.
 */
function Policy({ which, routed, onPolicy, children }: {
  which: 'terms' | 'guidelines'
  routed: boolean
  onPolicy?: (which: 'terms' | 'guidelines') => void
  children: ReactNode
}) {
  const look = 'font-semibold text-link hover:underline'
  if (onPolicy) {
    return (
      <button type="button" className={look} onClick={() => onPolicy(which)}>{children}</button>
    )
  }
  if (routed) return <Link to={policyUrl(which, true)} className={look}>{children}</Link>
  return (
    <a
      href={policyUrl(which)}
      target="_blank"
      rel="noreferrer"
      className={look}
    >
      {children}
    </a>
  )
}

/**
 * The same form does both jobs. A guest keeps the account they are already
 * signed in with, so nothing they made is thrown away when they decide to
 * stay; anybody else gets a new one.
 */
export function SignupForm({
  onSent, claiming, onClaimed, onPolicy,
}: {
  /**
   * Where to go and look, or null where there is nowhere: a signup with no
   * address is signed in by the time this is called.
   */
  onSent: (email: string | null) => void
  claiming?: boolean
  onClaimed?: () => void
  /**
   * What to do when somebody wants to read the terms or the guidelines.
   *
   * For an application that has no router and no address bar: it is handed
   * which one was asked for and opens it however it opens things. Left
   * out, the two are links on the site and plain addresses anywhere else.
   */
  onPolicy?: (which: 'terms' | 'guidelines') => void
}) {
  /*
   * Mountable with nothing around it, which is the whole point of this one.
   *
   * The Launcher signs people up in its own window now, and building a
   * second age gate there is exactly the second copy this repository exists
   * to prevent. So: `useMaybeAuth` rather than `useAuth`, because there is
   * no provider over there; the two signup calls come from `@/lib/signup`
   * when there is no provider to supply them; and the policy links below
   * stop being `<Link>`s when there is no router above this.
   *
   * `claimAccount` falls back the same way the other two do, which it did
   * not for two rounds: the function moved out to `@/lib/signup` and this
   * line kept reading it off the provider alone, so `<SignupForm claiming />`
   * outside the site threw "Keeping a guest account only works on the
   * website." The applications session found it. The exported one asks the
   * client who is signed in when nobody hands it a user, so there is
   * nothing for a caller without a provider to supply.
   */
  const auth = useMaybeAuth()
  const signUp = auth?.signUp ?? signUpWithEmail
  const signUpWithoutEmail = auth?.signUpWithoutEmail ?? signUpWithoutEmailAddress
  const claimAccount = auth?.claimAccount ?? claimTheAccount
  const routed = useInRouterContext()

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
         * the call comes back. `onSent(null)` is what the caller reads as
         * "there is nothing to go and check, they are in".
         *
         * It was `onSent('')` and the applications session asked for the
         * difference to be sayable rather than inferred from an empty
         * string - an empty address and no address are not the same thing,
         * and one of them is a bug somewhere else.
         */
        await signUpWithoutEmail(details)
        onSent(null)
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
        <p className="rounded-lg border-2 border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {errors.form}
        </p>
      )}

      <Button variant="yes" type="submit" size="lg" block loading={pending}>
        {claiming ? 'Keep this account' : 'Sign up'}
      </Button>

      <p className="text-center text-mini leading-relaxed text-muted">
        By carrying on you agree to our{' '}
        <Policy which="terms" routed={routed} onPolicy={onPolicy}>Terms of Service</Policy>
        {' '}and{' '}
        <Policy which="guidelines" routed={routed} onPolicy={onPolicy}>Community Guidelines</Policy>.
      </p>
    </form>
  )
}

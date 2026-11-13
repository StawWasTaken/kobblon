import { supabase } from '@/lib/supabase'
import { claimGuestAccount, linkGuestEmail, registerWithoutEmail, uploadAvatar } from '@/lib/api'
import { rememberAccount } from '@/lib/accounts'

/**
 * Making an account, as two functions rather than two methods on a hook.
 *
 * The applications session asked for this and the reason is the one this
 * repository is built on: signing up is not a function over there, it is
 * our form - the age gate, the live username check, the terms - and a
 * second copy of that is wrong for a year before anybody notices. The form
 * can only be mounted outside the site if what it calls can be, so the two
 * ways in live here, where nothing needs a provider above it.
 *
 * `AuthProvider` calls these rather than holding its own copies, so there
 * is one of each. `claimAccount` was the exception for several rounds -
 * it acts on a session rather than on a form, so it stayed a method. The
 * applications session asked for it anyway in round 97 and they are
 * right: holding a session is not the same as being a React provider, and
 * theirs holds one. It takes the account it is acting on as an argument
 * now, so anything with a signed-in guest can call it.
 *
 * `signInAsGuest` joined them in round 338, asked for by the applications
 * session, which keeps its own session store: the Launcher's "play as a
 * guest" is one call now, with nothing of the website around it.
 */
export type SignupDetails = {
  email: string
  password: string
  username: string
  displayName: string
  avatarFile: File | null
  birthDate: string
  gender: string
}

/**
 * Held when signup could not upload the picture yet because no session
 * existed - which is every project that asks for an email confirmation.
 *
 * It lives here rather than in the provider because the provider is no
 * longer what writes it. `takePendingAvatar` hands it over once and
 * forgets it, so a second sign-in does not upload the same file again.
 */
let pendingAvatar: File | null = null

export function takePendingAvatar(): File | null {
  const file = pendingAvatar
  pendingAvatar = null
  return file
}

/** The ordinary way in: an address, confirmed or not. */
export async function signUpWithEmail(details: SignupDetails): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email: details.email,
    password: details.password,
    options: {
      data: {
        username: details.username,
        display_name: details.displayName || details.username,
        // Nothing. A profile picture is a shot of their own avatar now,
        // drawn the first time they look at themselves - so an account
        // starts without one rather than wearing somebody else's face.
        avatar_url: '',
        birth_date: details.birthDate,
        gender: details.gender,
      },
    },
  })
  if (error) throw error

  // Joins the account switcher straight away. Supabase returns the new user
  // even when it is still waiting on an email confirmation, so this does not
  // depend on a session existing yet; the real picture and name overwrite
  // this once the profile loads.
  if (data.user) {
    rememberAccount({
      id: data.user.id,
      email: details.email,
      username: details.username,
      displayName: details.displayName || details.username,
      avatarUrl: null,
    })
  }

  // Storage needs a signed-in user. When the project asks for email
  // confirmation there is no session yet, so the picture is set on the first
  // sign-in instead and a Kobby picture stands in until then.
  if (details.avatarFile && data.session) {
    const url = await uploadAvatar(data.session.user.id, details.avatarFile)
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', data.session.user.id)
  } else if (details.avatarFile) {
    pendingAvatar = details.avatarFile
  }
}

/**
 * The same, for somebody who left the email box empty.
 *
 * The account is made behind the service role - see `register` - because
 * Supabase would otherwise send a confirmation email to a stand-in address
 * that nobody can read. What comes back is a session, so this tab is signed
 * in by the time it returns and there is nothing to go and check.
 */
export async function signUpWithoutEmailAddress(details: SignupDetails): Promise<void> {
  const tokens = await registerWithoutEmail({
    username: details.username,
    password: details.password,
    displayName: details.displayName || details.username,
    birthDate: details.birthDate,
    gender: details.gender,
  })

  const { error } = await supabase.auth.setSession(tokens)
  if (error) throw new Error(error.message)

  rememberAccount({
    id: (await supabase.auth.getUser()).data.user?.id ?? '',
    email: '',
    username: details.username,
    displayName: details.displayName || details.username,
    avatarUrl: null,
  })
}

/**
 * The way in with no account at all.
 *
 * A guest is a real but throwaway account, so presence, entering a World
 * and the chat dock all behave normally - it is not a signed-out mode with
 * features switched off. Supabase needs anonymous sign-ins turned on.
 *
 * Out here rather than on the provider because the Launcher signs in with
 * no provider above it and keeps the session in its own store. Keeping the
 * guest account afterwards is still `claimAccount` on the website's
 * provider, because that one acts on the session being held, not on a form.
 */
export async function signInAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

/**
 * A guest keeping what they made.
 *
 * The caller passes the account the session is for rather than this
 * reaching for one, which is the whole reason it can live here: a client
 * with its own session store has a user and no provider.
 *
 * What it does not do is anything about *this* website - the account
 * switcher and reloading the profile are the provider's, because they are
 * about a browser holding several accounts rather than about claiming one.
 * So it hands back the picture it uploaded and lets the caller decide what
 * else to remember.
 */
export async function claimAccount(
  details: SignupDetails,
  user: { id: string },
): Promise<{ avatarUrl: string | null }> {
  const avatarUrl = details.avatarFile
    ? await uploadAvatar(user.id, details.avatarFile)
    : null

  await claimGuestAccount({
    username: details.username,
    displayName: details.displayName || details.username,
    birthDate: details.birthDate,
    gender: details.gender,
    avatarUrl,
  })

  /*
   * The address goes on behind the service role when it can.
   *
   * A guest who has opened the Launcher already carries the stand-in
   * address `app-signin` gave them, and setting a real one over that is an
   * email *change* - confirmed from the old address, which is a mailbox
   * that does not exist. Linking only ever worked because a guest had no
   * address at all.
   *
   * `linkGuestEmail` says false when the function is not deployed, and
   * then the old path runs, which is still right for a guest who has never
   * opened an app.
   */
  const linked = await linkGuestEmail(details.email, details.password)

  const { error } = await supabase.auth.updateUser({
    ...(linked ? {} : { email: details.email, password: details.password }),
    data: {
      username: details.username,
      display_name: details.displayName || details.username,
      birth_date: details.birthDate,
      gender: details.gender,
    },
  })
  if (error) throw error

  return { avatarUrl }
}

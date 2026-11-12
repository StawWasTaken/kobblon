import { supabase } from '@/lib/supabase'
import { registerWithoutEmail, uploadAvatar } from '@/lib/api'
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
 * is one of each. `claimAccount` stays on the provider on purpose: it acts
 * on the guest session the provider is holding, so it is a method about a
 * session and not a function about a form.
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

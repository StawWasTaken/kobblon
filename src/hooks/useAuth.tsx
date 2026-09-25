import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { claimGuestAccount, signInWithUsername, uploadAvatar } from '@/lib/api'
import { randomAvatar } from '@/lib/avatars'
import { clearAccountSession, rememberAccount, updateAccountSession } from '@/lib/accounts'
import type { Profile } from '@/types/db'

type AuthValue = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (details: SignupDetails) => Promise<void>
  /** A guest keeping what they made, rather than starting again. */
  claimAccount: (details: SignupDetails) => Promise<void>
  signInWithName: (username: string, password: string) => Promise<void>
  signInAsGuest: () => Promise<void>
  switchTo: (account: { id: string; session?: { access_token: string; refresh_token: string } }) => Promise<boolean>
  /** Ending the session. `keep` leaves the tokens so switching back is instant. */
  signOut: (options?: { keep?: boolean }) => Promise<void>
  refreshProfile: () => Promise<void>
}

export type SignupDetails = {
  email: string
  password: string
  username: string
  displayName: string
  avatarFile: File | null
  birthDate: string
  gender: string
}

const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}

/**
 * The same thing, for a component that might be mounted outside the site.
 *
 * `useAuth` throws when there is no provider, which is right for a page:
 * a page with no session is a bug rather than a state. But the Workspace
 * mounts a few of these components on its own, with its own session and no
 * `AuthProvider` above them, and a throw there is the component refusing to
 * be shared at all. Null means "nobody told me", not "signed out".
 */
export function useMaybeAuth() {
  return useContext(AuthContext)
}

const PRESENCE_INTERVAL = 60_000

/** Held when signup could not upload yet because no session existed. */
let pendingAvatar: File | null = null

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const userId = session?.user.id ?? null
  const heartbeat = useRef<number | undefined>(undefined)

  const loadProfile = useCallback(async (
    id: string,
    email?: string,
    session?: { access_token: string; refresh_token: string },
  ) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
    const loaded = (data as Profile | null) ?? null
    setProfile(loaded)

    // Guests are throwaway, so they are not offered on the switcher.
    if (loaded && email && !loaded.is_guest) {
      rememberAccount(
        {
          id: loaded.id,
          email,
          username: loaded.username,
          displayName: loaded.display_name,
          avatarUrl: loaded.avatar_url,
        },
        session,
      )
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (!next) {
        setProfile(null)
        setLoading(false)
        return
      }

      // Supabase rotates the refresh token as it goes, so the copy the
      // switcher holds has to follow it. Capturing it only at sign in left a
      // stale token behind, which is why switching kept asking for the
      // password again.
      if (next.user.email && !next.user.is_anonymous) {
        updateAccountSession(next.user.id, {
          access_token: next.access_token,
          refresh_token: next.refresh_token,
        })
      }
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)

    const run = async () => {
      if (pendingAvatar) {
        const file = pendingAvatar
        pendingAvatar = null
        try {
          const url = await uploadAvatar(userId, file)
          await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
        } catch {
          // Not worth blocking sign-in over; the picture can be set later.
        }
      }
      await loadProfile(
        userId,
        session?.user.email ?? undefined,
        session
          ? { access_token: session.access_token, refresh_token: session.refresh_token }
          : undefined,
      )
    }

    run().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadProfile])

  // Keep presence honest: a heartbeat while the tab is alive, and a best
  // effort "gone" when it is hidden or closed.
  useEffect(() => {
    if (!userId) return

    const beat = (online: boolean) => supabase.rpc('touch_presence', { online })
    beat(true)
    heartbeat.current = window.setInterval(() => {
      if (document.visibilityState === 'visible') beat(true)
    }, PRESENCE_INTERVAL)

    const onHidden = () => {
      if (document.visibilityState === 'hidden') beat(false)
      else beat(true)
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', () => beat(false))

    return () => {
      window.clearInterval(heartbeat.current)
      document.removeEventListener('visibilitychange', onHidden)
      beat(false)
    }
  }, [userId])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signUp(details) {
        const { data, error } = await supabase.auth.signUp({
          email: details.email,
          password: details.password,
          options: {
            data: {
              username: details.username,
              display_name: details.displayName || details.username,
              // No upload means one of the Kobby pictures, decided here so
              // the account always has one.
              avatar_url: details.avatarFile ? '' : randomAvatar(),
              birth_date: details.birthDate,
              gender: details.gender,
            },
          },
        })
        if (error) throw error

        // Joins the account switcher straight away. Supabase returns the new
        // user even when it is still waiting on an email confirmation, so
        // this does not depend on a session existing yet; the real picture
        // and name overwrite this once the profile loads.
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
        // confirmation there is no session yet, so the picture is set on the
        // first sign-in instead and a Kobby picture stands in until then.
        if (details.avatarFile && data.session) {
          const url = await uploadAvatar(data.session.user.id, details.avatarFile)
          await supabase.from('profiles').update({ avatar_url: url }).eq('id', data.session.user.id)
        } else if (details.avatarFile) {
          pendingAvatar = details.avatarFile
        }
      },
      async claimAccount(details) {
        /*
         * The guest is already signed in, so the account stays and the email
         * and password are linked to it. Their Spaces, their friends and
         * anything they collected come with them.
         */
        const user = session?.user
        if (!user) throw new Error('You are not signed in as a guest.')

        const avatarUrl = details.avatarFile
          ? await uploadAvatar(user.id, details.avatarFile)
          : randomAvatar()

        await claimGuestAccount({
          username: details.username,
          displayName: details.displayName || details.username,
          birthDate: details.birthDate,
          gender: details.gender,
          avatarUrl,
        })

        const { error } = await supabase.auth.updateUser({
          email: details.email,
          password: details.password,
          data: {
            username: details.username,
            display_name: details.displayName || details.username,
            birth_date: details.birthDate,
            gender: details.gender,
          },
        })
        if (error) throw error

        rememberAccount({
          id: user.id,
          email: details.email,
          username: details.username,
          displayName: details.displayName || details.username,
          avatarUrl,
        })

        await loadProfile(user.id, details.email)
      },
      async signInWithName(username, password) {
        await signInWithUsername(username, password)
      },
      async switchTo(account) {
        if (!account.session) return false
        const { error } = await supabase.auth.setSession(account.session)
        // A refresh token that has expired or been used elsewhere means this
        // account has to sign in again.
        if (error) {
          clearAccountSession(account.id)
          return false
        }
        return true
      },
      async signInAsGuest() {
        // A guest is a real but throwaway account, so presence, entering a
        // Space and the chat dock all behave normally. Supabase needs
        // anonymous sign-ins turned on for this.
        const { error } = await supabase.auth.signInAnonymously()
        if (error) throw error
      },
      async signOut(options) {
        await supabase.rpc('touch_presence', { online: false })
        /*
         * Logging out has to actually log out, so the tokens go with it while
         * the account stays on the switcher. Stepping aside to use another
         * account is not logging out, and keeps them: a local sign out does
         * not revoke anything server side, so switching back is instant
         * rather than another password.
         */
        if (userId && !options?.keep) clearAccountSession(userId)
        // Local scope only: a global sign out revokes every refresh token for
        // this account, including the ones other accounts on this device are
        // not using yet.
        await supabase.auth.signOut({ scope: 'local' })
      },
      async refreshProfile() {
        if (userId) await loadProfile(userId, session?.user.email ?? undefined)
      },
    }),
    [session, profile, loading, userId, loadProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* A signed-in session, with nothing behind it.
 *
 * The five browsing pages each decide part of their layout from who is
 * looking: People lifts your own card out of the grid, Communities and
 * People gain a rail entry for what is yours, the Catalog puts Favourites
 * and Basket at the foot of its rail. The real `AuthProvider` reaches the
 * network to find that out, so a preview that uses it shows the signed-out
 * shape of all five - which is the one shape that cannot be checked against
 * what Staw actually sees.
 *
 * So the preview config aliases `@/hooks/useAuth` to this. It is a fixture
 * for looking at pages with, and it is in tools/ rather than src/ so nothing
 * the site ships can reach it.
 */
import type { ReactNode } from 'react'
import type { Profile } from '@/types/db'

export const me = {
  id: '11111111-1111-1111-1111-111111111111',
  content_id: 1010,
  username: 'stawrer',
  display_name: 'Staw',
  avatar_url: null,
  bio: 'Running this place. Ask me for a hat.',
  pixels: 48_200,
  is_online: true,
  is_guest: false,
  is_admin: true,
  is_moderator: false,
  is_superadmin: true,
  is_verified: true,
  has_staff_badge: true,
  created_at: new Date(Date.now() - 400 * 86_400_000).toISOString(),
  last_seen_at: new Date().toISOString(),
  in_space_id: null,
  activity: null,
  birth_date: '2004-05-09',
  colour: null,
} as unknown as Profile

const value = {
  session: { user: { id: me.id, email: 'staw@kobblon.com' } },
  profile: me,
  loading: false,
  signIn: async () => {},
  signUp: async () => {},
  signUpWithoutEmail: async () => {},
  claimAccount: async () => {},
  signInWithName: async () => {},
  signInAsGuest: async () => {},
  switchTo: async () => true,
  signOut: async () => {},
  refreshProfile: async () => {},
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

export const useAuth = () => value as never
export const useMaybeAuth = () => value as never
export const AuthProvider = ({ children }: { children: ReactNode }) => children

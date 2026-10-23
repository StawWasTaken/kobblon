import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { siteState, type SiteState } from '@/lib/api'
import Maintenance from '@/pages/Maintenance'

/**
 * The shutters, in front of everything.
 *
 * Wrapped around the whole router rather than put on a page, because what
 * Staw asked for is the website and not a corner of it: "a button that makes
 * the whole website redirected to a page saying we are under maintenance".
 *
 * Who walks past it: admins and superadmins. A moderator does not - "mods
 * are still affected tho" - and neither does anybody else. The ranks come
 * off the profile that is already loaded rather than from another call, and
 * that is sound here for the one reason that matters: **this decides what is
 * drawn and nothing else.** Nothing is kept behind it; every table and
 * function is exactly as reachable while the shutters are down as while they
 * are up, and the database decides every one of those as it always did. A
 * curtain whose edge somebody can lift is still the right thing when what is
 * behind it is a website that is merely asked not to be used.
 *
 * Three things it is careful about:
 *
 *   * **It asks again, every minute.** Somebody left looking at this screen
 *     should see the site come back without being told to reload.
 *   * **A failed ask is not a shut site.** `siteState` answers null when the
 *     call fails and null draws the website, because the alternative is a
 *     hiccup in one request taking Kobblon down for everybody.
 *   * **`/login` stays open.** The people who can turn this off need a
 *     session to do it with, and a signed-out admin behind the curtain with
 *     no way to sign in is how a maintenance switch becomes a locked door.
 */
export function Shutters({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const location = useLocation()
  const [state, setState] = useState<SiteState | null>(null)

  useEffect(() => {
    let wanted = true
    const ask = async () => {
      const answer = await siteState()
      /*
       * The token, not the current value. An answer that came back after
       * this component went away, or after a newer ask overtook it, is an
       * answer nobody wants any more.
       */
      if (wanted) setState(answer)
    }
    void ask()
    const again = window.setInterval(() => { void ask() }, 60_000)
    return () => { wanted = false; window.clearInterval(again) }
  }, [])

  const staff = !!profile?.is_admin || !!profile?.is_superadmin

  /*
   * While the session is still being worked out, nobody is shut out. An
   * admin whose profile has not arrived yet is an admin, and half a second
   * of the website is a far smaller wrong than half a second of a closed
   * sign that then disappears.
   */
  const shut = !!state?.maintenance && !staff && !loading
    && !location.pathname.startsWith('/login')

  if (shut) return <Maintenance note={state?.note} />

  return <>{children}</>
}

import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { siteState, type SiteState } from '@/lib/api'
import { watchReachable } from '@/lib/reachable'
import { supabase } from '@/lib/supabase'
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
 *   * **It is told, rather than finding out.** The one row is published, so
 *     the switch reaches every open tab the moment it is thrown - Staw: "i
 *     want that the shutters appear instantly rather than having to refresh
 *     the page". The minute's ask stays underneath it, because a socket
 *     that quietly dropped an hour ago is a tab that would never hear, and
 *     the one thing worse than a slow curtain is one that never arrives.
 *   * **A failed ask is not a shut site.** `siteState` answers null when the
 *     call fails and null draws the website, because the alternative is a
 *     hiccup in one request taking Kobblon down for everybody.
 *   * **`/login` stays open.** The people who can turn this off need a
 *     session to do it with, and a signed-out admin behind the curtain with
 *     no way to sign in is how a maintenance switch becomes a locked door.
 *
 * ## The curtain nobody threw
 *
 * There is a second way this page appears, and it is not the switch. Staw:
 * "i want that when theres an issue about the database, instead of saying
 * that stuff cant load bc of the database, make that the in maintenance
 * mode is automatically activated."
 *
 * It cannot be the switch, because the switch is a row in the database: when
 * the database is what has fallen over, nothing can write that row and
 * nothing can read it. So each tab decides for itself, out of the only
 * evidence it has - that its own calls have stopped being answered - and
 * `@/lib/reachable` is where that is counted. One page instead of twenty
 * "that did not load" boxes.
 *
 * **Staff do not walk past this one.** The switch is a request not to use
 * the site and staff are exempt from it; an outage is not a request, and
 * there is nothing behind the curtain for an admin either. It lifts itself
 * the moment any call is answered, so nobody has to turn it off.
 */
export function Shutters({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  const location = useLocation()
  const [state, setState] = useState<SiteState | null>(null)
  const [reachable, setReachable] = useState(true)

  useEffect(() => watchReachable(({ reachable: now }) => setReachable(now)), [])

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
    /*
     * Every ten seconds while the database is not answering, every minute
     * while it is. The quick one is what lifts the automatic curtain: it is
     * the only thing still knocking, so how often it knocks is how long
     * somebody looks at a closed sign after the database has come back.
     */
    const again = window.setInterval(() => { void ask() }, reachable ? 60_000 : 10_000)

    /*
     * The row itself, as it changes. It carries `maintenance` and `note`,
     * which is the whole of what this draws, so nothing is asked again -
     * and `replica identity full` in 0273 is what makes that true.
     */
    const channel = supabase
      .channel('shutters')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'site_state' },
        (payload) => { if (wanted) setState(payload.new as SiteState) })
      .subscribe()

    return () => {
      wanted = false
      window.clearInterval(again)
      void supabase.removeChannel(channel)
    }
  }, [reachable])

  const staff = !!profile?.is_admin || !!profile?.is_superadmin

  /*
   * While the session is still being worked out, nobody is shut out. An
   * admin whose profile has not arrived yet is an admin, and half a second
   * of the website is a far smaller wrong than half a second of a closed
   * sign that then disappears.
   */
  const onLogin = location.pathname.startsWith('/login')

  /* The switch: staff walk past it, and `/login` stays open. */
  const shut = !!state?.maintenance && !staff && !loading && !onLogin

  /* The outage: nobody walks past it, and `/login` is no use either - there
     is nothing to sign in to. */
  const deaf = !reachable && !onLogin

  if (deaf) return <Maintenance outage />
  if (shut) return <Maintenance note={state?.note} />

  return <>{children}</>
}

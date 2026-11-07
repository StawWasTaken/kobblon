import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { AccountStatusCard } from '@/components/social/AccountStatusCard'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { accountStanding, acknowledgeStanding } from '@/lib/api'

/**
 * The card a decision puts in front of the account it was made about,
 * wherever that account happens to be standing.
 *
 * Staw drew it as a popup rather than a page: "this card appears everywhere
 * on the logged in pages (+forum)". So it is one mount beside the router
 * rather than a screen each side of the site swaps in, which is what it was
 * - `Locked` stood in for the whole of `AppShell`'s outlet and the forum,
 * which is half the site, never saw it at all.
 *
 * The three states differ in what is behind the card, and in nothing else:
 *
 *   warned     the account is untouched. The card is over it until they say
 *              they have read it, and then it is gone and they carry on.
 *   suspended  the page behind is blank - the bar and the rail stay, so they
 *              can see where they are - until the time on it is spent and
 *              the same box lets them back.
 *   banned     the same blank, no box, and the way out is the one thing a
 *              closed account can still do: sign out.
 *
 * A feature block ('limited') gets no card here on purpose. It leaves the
 * account working and it has no answer to it, so a popup over everything
 * would be a door painted on a wall; the standing page holds it.
 */

/**
 * The pages a decision must not close, and so the pages the card stands
 * aside for: its own four doors all land on one of them. The appeal, the
 * record, support and the rules are the only things somebody has left, and
 * a modal over the appeal form is the same as having no appeal.
 */
const SPARED = [
  '/standing', '/support', '/guidelines', '/policies', '/terms', '/privacy',
  '/login', '/signup', '/creator/sign-in', '/launcher/sign-in',
]

export const sparedFromStanding = (path: string) =>
  SPARED.some((one) => path.startsWith(one))

/**
 * Whether the page behind the card is blank.
 *
 * Read off the profile row rather than the standing call, because it has to
 * be known on the same render as the page it is replacing - waiting for an
 * RPC would show one frame of somebody's Home before taking it away.
 */
export const standingShuts = (
  profile: { is_suspended?: boolean | null; is_banned?: boolean | null } | null | undefined,
  path: string,
) => (!!profile?.is_suspended || !!profile?.is_banned) && !sparedFromStanding(path)

export function StandingGate() {
  const { session, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const say = useToast()
  const [sending, setSending] = useState(false)
  const [answered, setAnswered] = useState(false)

  /*
   * Asked once per account, and asked again when the row changes under it:
   * a moderator lifting a suspension writes `is_suspended`, and the card
   * has to go without a reload. Nothing is asked at all with nobody signed
   * in, which is every page a visitor sees.
   */
  const standing = useAsync(
    async () => (session ? accountStanding() : null),
    [session?.user?.id, profile?.is_suspended, profile?.is_banned],
  )

  const one = standing.data
  const shows = !!one && (one.level === 'warned' || one.level === 'suspended' || one.level === 'banned')

  if (!shows || answered || sparedFromStanding(location.pathname)) return null

  const answer = async () => {
    setSending(true)
    try {
      const what = await acknowledgeStanding()
      if (what === 'back' || what === 'warning_cleared') {
        setAnswered(true)
        say(
          what === 'back' ? 'Welcome back. Keep it clean.' : 'Noted. Keep it clean.',
          'success',
        )
        /*
         * The row the rest of the page reads has changed, and a suspension
         * coming off changes what every other page may do. Reloaded rather
         * than patched in place, because that is one truth instead of two.
         */
        if (what === 'back') window.location.reload()
        return
      }
      say('That did not go through.', 'error')
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    }
    setSending(false)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto overscroll-contain bg-black/80 p-4 py-10 backdrop-blur-sm kob-scroll sm:py-14"
      role="dialog"
      aria-modal="true"
      aria-label={one.headline}
    >
      <div className="w-full max-w-xl animate-pop-in space-y-3">
        <AccountStatusCard
          standing={one}
          busy={sending}
          onAcknowledge={one.can_acknowledge ? () => void answer() : undefined}
          /* The doors stay inside the site: an href here would be a whole
             page load, and on a static host that is a round trip through
             the 404 fallback for a link two components away. */
          onOpen={(href) => navigate(href)}
        />
        {/*
          * The way out, on the card Staw asked for it on. A closed account
          * has nothing left to acknowledge, so without this the only thing
          * it could do was close the tab.
          */}
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-xs text-muted">
            {one.level === 'banned'
              ? 'Signing out is safe. Your record and the appeal on it stay where they are.'
              : 'You are still signed in, so support and your record stay open to you.'}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-ink-line bg-ink-raised px-3 py-1.5 text-xs font-bold text-white hover:border-white/25"
          >
            <Glyph icon={faRightFromBracket} />
            Log out
          </button>
        </div>
      </div>
    </div>
  )
}

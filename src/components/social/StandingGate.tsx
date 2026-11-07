import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
 * A feature block ('limited') is the fourth, and it is here too now -
 * Staw was still seeing the old card on Home and asked for every one of
 * them to come through this. It leaves the account working and there is
 * nothing to press on it, so it is the one that can be closed: a notice,
 * not a gate. "Got it" is written down where the other three are, on
 * `violations.acknowledged_at` (0332), and not in this browser - a
 * decision about an account is not a per-browser fact, and remembering
 * it here would show the card again on their phone as though they had
 * never read it. The block itself stays on; it is the card that stops.
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
  /* The only one that can be closed: it shuts nothing and asks nothing. */
  const closeable = one?.level === 'limited'
  /* And once it has been read it is read, on every device, for good. */
  const shows = !!one && one.level !== 'clear' && !(closeable && one.acknowledged)

  if (!shows || answered || sparedFromStanding(location.pathname)) return null

  const answer = async () => {
    setSending(true)
    try {
      const what = await acknowledgeStanding()
      /*
       * 'nothing' counts as done for a restriction. It is what the server
       * says when there was no open row to mark, which on this card means
       * somebody else already marked it or 0332 is not applied yet -
       * neither is a reason to keep showing a notice to somebody who has
       * just pressed Got it.
       */
      if (what === 'back' || what === 'warning_cleared' || what === 'noted'
        || (closeable && what === 'nothing')) {
        setAnswered(true)
        if (what === 'back') say('Welcome back. Keep it clean.', 'success')
        else if (what === 'warning_cleared') say('Noted. Keep it clean.', 'success')
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
      /*
         Centred, and standing up rather than lying down. It was pinned to
         the top of the window at the width of a page column, which put a
         short card in the corner of a big screen reading as a banner that
         had slipped. A decision about somebody's account is the only thing
         on the screen while it is up, so it sits in the middle of it and it
         is the shape of a card: narrow, tall, one button.
       */
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto overscroll-contain bg-black/80 p-4 py-10 backdrop-blur-sm kob-scroll"
      role="dialog"
      aria-modal="true"
      aria-label={one.headline}
    >
      <AccountStatusCard
        className="my-auto flex w-full max-w-[27rem] animate-pop-in flex-col sm:min-h-[26rem]"
        standing={one}
        busy={sending}
        onAcknowledge={one.can_acknowledge ? () => void answer() : undefined}
        /* Read once and it stays read, on the row rather than in this
           browser. The restriction itself stays on; the card stops. */
        onClose={closeable ? () => void answer() : undefined}
        /* The only thing a closed account can still do, and without it the
           card was a room with no door. */
        onSignOut={one.level === 'banned' ? () => void signOut() : undefined}
        /* The doors stay inside the site: an href here would be a whole
           page load, and on a static host that is a round trip through the
           404 fallback for a link two components away. */
        onOpen={(href) => navigate(href)}
      />
    </div>
  )
}

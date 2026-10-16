import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faBan, faClock, faScroll, faRightFromBracket, faArrowRotateLeft, faGavel,
} from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { accountStanding, reactivateAccount } from '@/lib/api'
import { cn } from '@/lib/cn'

/**
 * What somebody sees when their account is shut out.
 *
 * Until this existed a suspension changed nothing the suspended person could
 * see: every refusal came back as "that did not work" from whatever they
 * happened to press, which reads as a broken website rather than as a
 * decision somebody made about them. A platform that takes something away
 * has to say so to the person it took it from, in their own language,
 * with the reason and the date on it.
 *
 * Three things it has to carry and they are the whole design:
 *
 * - **What happened and why.** The reason as written, the rule it was
 *   under, and the day. Not "violation of our terms".
 * - **When it ends**, or that it does not. A suspension with no date on it
 *   is indistinguishable from a ban to the person serving it.
 * - **The two doors out.** Appealing it, which is a right and not a favour,
 *   and coming back once it has run out.
 *
 * Nothing here is cheerful and nothing here is cruel. Kobby is not on this
 * screen: a mascot beside a suspension is a company smiling at somebody it
 * has just punished.
 */
export function Locked() {
  const say = useToast()
  const { profile, signOut } = useAuth()
  const standing = useAsync(async () => accountStanding(), [profile?.id])
  const [coming, setComing] = useState(false)

  const one = standing.data
  const banned = one?.level === 'terminated'

  const until = one?.until ? new Date(one.until) : null
  const over = !!until && until.getTime() <= Date.now()

  const comeBack = async () => {
    setComing(true)
    try {
      const back = await reactivateAccount()
      if (back) {
        say('Welcome back. Keep it clean.', 'success')
        window.location.assign('/')
        return
      }
      say('That did not go through.', 'error')
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    }
    setComing(false)
  }

  return (
    <Page width="narrow" className="py-10">
      <Card className="overflow-hidden p-0">
        <div className={cn(
          'flex items-center gap-3 border-b px-6 py-4',
          banned
            ? 'border-danger/40 bg-danger/10 text-danger'
            : 'border-amber-400/40 bg-amber-400/10 text-amber-300',
        )}>
          <Glyph icon={banned ? faBan : faClock} className="text-xl" />
          <div className="min-w-0">
            <h1 className="text-lg font-black">
              {standing.loading
                ? 'Reading your account'
                : (one?.headline ?? 'Your account is shut out')}
            </h1>
            <p className="text-xs font-semibold opacity-80">
              {banned
                ? 'This one is permanent.'
                : until
                  ? (over
                    ? 'It has run out. You can come back.'
                    : `Until ${until.toLocaleString(undefined, {
                      day: 'numeric', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}`)
                  : 'No end date was set.'}
            </p>
          </div>
        </div>

        <div className="space-y-6 p-6">
          {standing.loading && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}

          {!standing.loading && (
            <>
              {/* The reason, as it was written. Nobody is told "a violation
                  occurred" and left to guess which thing they did. */}
              <section className="space-y-2">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Why
                </h2>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/85">
                  {one?.why?.trim() || 'No reason was recorded, which is itself worth appealing.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted">
                  {one?.rule && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line bg-ink-raised px-2 py-1">
                      <Glyph icon={faGavel} className="text-[10px]" />
                      {one.rule}
                    </span>
                  )}
                  {one?.decided_at && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-line bg-ink-raised px-2 py-1">
                      <Glyph icon={faClock} className="text-[10px]" />
                      {new Date(one.decided_at).toLocaleDateString(undefined, {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </section>

              <section className="space-y-2 rounded-xl border border-ink-line bg-ink-raised p-4">
                <h2 className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  What you can do
                </h2>
                <p className="text-sm leading-relaxed text-white/75">
                  {one?.appeal_status
                    ? `Your appeal is ${one.appeal_status}. You will get a letter when it is decided.`
                    : one?.can_appeal
                      ? 'If this is wrong, say so. Somebody reads every appeal, and an appeal that is upheld takes the decision off your record entirely.'
                      : 'This one cannot be appealed again.'}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {one?.can_appeal && !one.appeal_status && (
                    <Button
                      to={one.violation_id ? `/standing/${one.violation_id}` : '/standing'}
                      icon={faScroll}
                    >
                      Appeal it
                    </Button>
                  )}
                  {one?.can_return && (
                    <Button
                      variant="yes"
                      icon={faArrowRotateLeft}
                      loading={coming}
                      onClick={() => void comeBack()}
                    >
                      Come back
                    </Button>
                  )}
                  <Button variant="subtle" to="/standing">Your record</Button>
                  <Button variant="subtle" to="/guidelines">The rules</Button>
                </div>
              </section>

              {/* Said plainly, because it is the question everybody asks and
                  the answer is the same either way: nothing is deleted. */}
              <p className="text-xs leading-relaxed text-muted">
                Nothing of yours has been deleted. Your things, your Worlds and your
                Brix are where you left them, and they come back with you.
              </p>
            </>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-ink-line pt-5">
            <Link to="/support" className="text-xs font-semibold text-link hover:underline">
              Talk to support
            </Link>
            <Button variant="ghost" icon={faRightFromBracket} onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </Card>
    </Page>
  )
}

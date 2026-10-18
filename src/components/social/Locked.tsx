import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faRightFromBracket } from '@fortawesome/free-solid-svg-icons'
import { Page } from '@/components/layout/AppShell'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import { AccountStatusCard } from '@/components/social/AccountStatusCard'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { accountStanding, acknowledgeStanding } from '@/lib/api'

/**
 * What somebody sees when their account is shut out.
 *
 * The card itself moved to `AccountStatusCard`, which the homepage mounts
 * too and the Workspace can mount beside its own sign-in; this is the page
 * that stands in for every other page while a suspension or a closure is
 * running. The session is not touched - signing somebody out for a sanction
 * takes away the record, the appeal and support, which are the only three
 * things they have left.
 *
 * Nothing here is cheerful and nothing here is cruel. Kobby is not on this
 * screen: a mascot beside a suspension is a company smiling at somebody it
 * has just punished.
 */
export function Locked() {
  const say = useToast()
  const { profile, signOut } = useAuth()
  const standing = useAsync(async () => accountStanding(), [profile?.id])
  const [sending, setSending] = useState(false)

  const one = standing.data

  const answer = async () => {
    setSending(true)
    try {
      const what = await acknowledgeStanding()
      if (what === 'back') {
        say('Welcome back. Keep it clean.', 'success')
        window.location.assign('/')
        return
      }
      say('That did not go through.', 'error')
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    }
    setSending(false)
  }

  return (
    <Page width="narrow" className="py-10">
      {standing.loading && (
        <Card className="space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </Card>
      )}

      {!standing.loading && one && (
        <AccountStatusCard
          standing={one}
          busy={sending}
          onAcknowledge={one.can_acknowledge ? () => void answer() : undefined}
        />
      )}

      <div className="mt-4 flex items-center justify-between gap-3 px-1">
        <Link to="/support" className="text-xs font-semibold text-link hover:underline">
          Still stuck? Talk to support
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-white"
        >
          <Glyph icon={faRightFromBracket} />
          Sign out
        </button>
      </div>
    </Page>
  )
}

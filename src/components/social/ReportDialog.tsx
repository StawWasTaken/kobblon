import { useEffect, useState } from 'react'
import {
  faFlag, faFaceAngry, faBullhorn, faEyeSlash, faHandFist, faUserSecret,
  faGavel, faCircleQuestion, faLock, faPaperPlane,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Tiles } from '@/components/ui/Tiles'
import { useToast } from '@/components/ui/Toast'
import { useMaybeAuth } from '@/hooks/useAuth'
import { submitReport } from '@/lib/api'

/**
 * Reporting something, redrawn to match the rest of the house.
 *
 * Staw: "now the same for the report popup card". It was the oldest card on
 * the platform and it showed: native radio inputs with `accent-[#1B34E8]`
 * typed straight into the class list, no icons, a curly apostrophe nothing
 * else here uses, and its own copy of the tile picker the Contact us card
 * already had.
 *
 * Two things were worse than the paint, and both are fixed here:
 *
 * - **It arrived with "Harassment or bullying" already chosen.** Press Send
 *   without reading and you have accused somebody of harassment. A report is
 *   the one form on this platform where the default answer is a thing said
 *   about another person, so it now starts on nothing and Send stays off
 *   until a reason is picked.
 * - **Signed out, Send did nothing at all.** `if (!profile) return` - no
 *   error, no toast, no hint. A button that is drawn, pressable, and inert
 *   is worse than no button; the card now says so before you type anything.
 */
const reasons: { value: string; label: string; icon: IconDefinition }[] = [
  { value: 'harassment', label: 'Harassment or bullying', icon: faFaceAngry },
  { value: 'spam', label: 'Spam, or an ad hiding what it is', icon: faBullhorn },
  { value: 'sexual', label: 'Sexual content', icon: faEyeSlash },
  { value: 'violence', label: 'Threats or violence', icon: faHandFist },
  { value: 'impersonation', label: 'Pretending to be someone', icon: faUserSecret },
  { value: 'illegal', label: 'Something illegal', icon: faGavel },
  { value: 'other', label: 'Something else', icon: faCircleQuestion },
]

/** What the thing is, in a word, for the line under the name. */
const thingWord: Record<string, string> = {
  profile: 'An account',
  space: 'A World',
  message: 'A message',
  ad: 'An advert',
  asset: 'An upload',
  community: 'A Community',
  style: 'A look',
  avatar_item: 'An avatar item',
  outfit: 'An outfit',
}

export function ReportDialog({
  open, onClose, targetType, targetId, targetName,
}: {
  open: boolean
  onClose: () => void
  targetType: 'profile' | 'space' | 'message' | 'ad' | 'asset' | 'community' | 'style' | 'avatar_item' | 'outfit'
  targetId: string
  targetName: string
}) {
  /* Not `useAuth`: that throws without a provider, and this card is opened
     from an asset page the Workspace can mount. Null means nobody told us. */
  const auth = useMaybeAuth()
  const profile = auth?.profile ?? null
  const toast = useToast()
  const [reason, setReason] = useState<string | null>(null)
  const [details, setDetails] = useState('')
  const [pending, setPending] = useState(false)

  /* A card that is closed and opened again is a new report. Without this it
     kept the last one's reason and words, so reporting a second thing began
     half filled in with something said about the first. */
  useEffect(() => {
    if (!open) return
    setReason(null)
    setDetails('')
  }, [open])

  const send = async () => {
    if (!profile || !reason) return
    setPending(true)
    try {
      await submitReport({
        reporterId: profile.id, targetType, targetId, reason, details: details.trim(),
      })
      toast('Sent. A moderator reads every one of these.', 'success')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That report did not send.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Report ${targetName}`}
      size="lg"
      head={
        <div className="bg-gradient-to-br from-danger/15 to-ink-card px-5 py-5">
          <div className="flex items-start gap-4 pr-10">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-danger/40 bg-danger/15 text-danger">
              <Glyph icon={faFlag} className="text-lg" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
                {thingWord[targetType] ?? 'Something'} · private
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-extrabold leading-tight">
                Report {targetName}
              </h2>
            </div>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-3">
          <p className="order-first w-full min-w-0 text-sm text-muted sm:order-none sm:w-auto sm:flex-1">
            {!profile
              ? 'Sign in and you can send this.'
              : reason
                ? 'Nobody is told you sent this.'
                : 'Pick what is wrong with it.'}
          </p>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            icon={faPaperPlane}
            loading={pending}
            disabled={!profile || !reason}
            onClick={send}
          >
            Send report
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {!profile && (
          <p className="flex items-start gap-3 rounded-xl border border-ink-line bg-ink-raised px-4 py-3 text-sm leading-relaxed text-white/75">
            <Glyph icon={faLock} className="mt-0.5 shrink-0 text-sm text-muted" />
            <span>
              Reports are tied to the account that sends them, so we can come back to you
              and so nobody can bury somebody under a hundred of them.{' '}
              <a href="/login" className="font-bold text-link hover:underline">Sign in</a> and
              this card will send.
            </span>
          </p>
        )}

        <div className="space-y-2.5">
          <h3 className="text-[11px] font-extrabold uppercase tracking-wide text-muted">
            What is wrong with it
          </h3>
          <Tiles
            label="What is wrong with it"
            value={reason}
            onChange={setReason}
            options={reasons}
            columns={2}
          />
        </div>

        <div>
          <label htmlFor="report-details" className="mb-1.5 block text-sm font-bold">
            Anything else
            <span className="ml-1.5 font-medium text-white/30">optional</span>
          </label>
          <textarea
            id="report-details"
            data-nofocus
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Where it was, when, and what we should be looking at."
            className="w-full resize-y rounded-xl border border-ink-line bg-ink-raised p-3 text-sm leading-relaxed outline-none transition-colors placeholder:text-white/30 focus:border-brand-bright"
          />
          <p className="mt-1.5 text-xs text-muted">
            It will not slow anything down, but it is usually what decides it.
          </p>
        </div>

        {/* What actually happens, said plainly. A report that disappears into
            a toast and is never mentioned again is why people stop sending
            them. */}
        <p className="text-sm leading-relaxed text-muted">
          A moderator reads it. The person is not told who reported them, and you will not
          hear the outcome - what was done about somebody else is their business, not a
          notification. If it needs more from you, we will write to you on Support.
        </p>
      </div>
    </Dialog>
  )
}

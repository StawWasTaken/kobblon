import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { submitReport } from '@/lib/api'
import { cn } from '@/lib/cn'

const reasons = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam', label: 'Spam, or an ad that will not say what it is' },
  { value: 'sexual', label: 'Sexual content' },
  { value: 'violence', label: 'Threats or violence' },
  { value: 'impersonation', label: 'Pretending to be someone' },
  { value: 'illegal', label: 'Something illegal' },
  { value: 'other', label: 'Something else' },
]

export function ReportDialog({
  open, onClose, targetType, targetId, targetName,
}: {
  open: boolean
  onClose: () => void
  targetType: 'profile' | 'space' | 'message' | 'ad' | 'asset' | 'community' | 'style' | 'avatar_item'
  targetId: string
  targetName: string
}) {
  const { profile } = useAuth()
  const toast = useToast()
  const [reason, setReason] = useState('harassment')
  const [details, setDetails] = useState('')
  const [pending, setPending] = useState(false)

  const send = async () => {
    if (!profile) return
    setPending(true)
    try {
      await submitReport({ reporterId: profile.id, targetType, targetId, reason, details })
      toast('Report sent. A moderator will look at it.', 'success')
      setDetails('')
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
      description="Tell us what's wrong. Reports are private and go to Kobblon moderators."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={pending} onClick={send}>Send report</Button>
        </>
      }
    >
      <fieldset>
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          What&apos;s the problem?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {reasons.map((r) => (
            <label
              key={r.value}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                reason === r.value
                  ? 'border-brand-bright bg-brand/20 text-white'
                  : 'border-ink-line bg-ink-raised text-white/70 hover:bg-ink-hover',
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-[#1B34E8]"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Textarea
        label="Anything else?"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        maxLength={1000}
        placeholder="Optional, but it helps."
        className="mt-5"
      />
    </Dialog>
  )
}

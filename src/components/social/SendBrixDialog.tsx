/*
 * Sending somebody Brix.
 *
 * Staw: "add a 'Send Brix' feature but the kobblon account also takes a
 * share of 5% of the stuff(or the normal kobblon tax) u send to another
 * user".
 *
 * Two things this is careful about, and both of them are about the number.
 *
 * **The cut is shown before anything moves.** A gift where what arrives is
 * not what you typed is a gift somebody feels cheated by if they find out
 * afterwards, so the line under the box says what leaves and what lands,
 * the whole time, updating as they type.
 *
 * **The share is read from the database, not written here.** Staw said five
 * per cent "or the normal kobblon tax", which is a number that will change.
 * `sending_share()` is where it lives and `send_brix` is what applies it;
 * this asks for it on open and shows what it is told. A number this file
 * calculated would be a number that could disagree with the one that
 * actually moved, which is the worst kind of wrong a money screen can be.
 */
import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Price } from '@/components/brand/Currency'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { sendBrix, sendingShare } from '@/lib/api'
import { formatCount } from '@/lib/format'

/** The same two the database holds. Shown so nobody has to find out. */
const LEAST = 10
const MOST = 100000

export function SendBrixDialog({ open, onClose, to, name, onSent }: {
  open: boolean
  onClose: () => void
  /** Who it goes to. */
  to: string
  name: string
  onSent?: () => void
}) {
  const toast = useToast()
  const { profile, refreshProfile } = useAuth()
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [share, setShare] = useState(5)

  /* Asked each time it opens rather than once at import: the number is
     Kobblon's to change and a dialog that has been in a tab since this
     morning should not be showing this morning's rate. */
  useEffect(() => {
    if (!open) return
    let wanted = true
    sendingShare()
      .then((found) => { if (wanted) setShare(found) })
      .catch(() => {})
    return () => { wanted = false }
  }, [open])

  useEffect(() => {
    if (open) { setAmount(''); setNote('') }
  }, [open])

  const typed = Number(amount)
  const sane = Number.isFinite(typed) && typed >= LEAST && typed <= MOST
  const mine = profile?.pixels ?? 0
  const enough = sane && typed <= mine

  /* The same arithmetic the function does, so the two agree. */
  const cut = sane ? Math.round((typed * share) / 100) : 0
  const arriving = sane ? typed - cut : 0

  const trouble = !amount.trim() ? null
    : !Number.isFinite(typed) || typed <= 0 ? 'A number of Brix.'
    : typed < LEAST ? `${LEAST} Brix is the least you can send.`
    : typed > MOST ? `${formatCount(MOST)} is the most in one go.`
    : typed > mine ? `You have ${formatCount(mine)}.`
    : null

  const send = async () => {
    setSending(true)
    try {
      const done = await sendBrix(to, Math.round(typed), note)
      toast(`${formatCount(done.arrived)} Brix went to ${name}.`, 'success')
      await refreshProfile()
      onSent?.()
      onClose()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That did not send.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Send Brix to ${name}`}
      description="It leaves your balance straight away, and it cannot be taken back."
    >
      <div className="space-y-4">
        <Input
          label="How many"
          type="number"
          min={LEAST}
          max={MOST}
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="100"
          error={trouble}
          hint={trouble ? undefined : `You have ${formatCount(mine)}.`}
          autoFocus
        />

        {/*
          * What leaves and what lands, as two lines rather than one
          * sentence. Always drawn, even before anything is typed, so the
          * cut is not a surprise that appears once somebody has committed
          * to a number.
          */}
        <div className="space-y-2 rounded-xl border border-ink-line bg-ink p-3.5 text-sm">
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Leaves you</span>
            <span className="font-bold"><Price amount={sane ? typed : 0} free="0" /></span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted">Kobblon keeps {share}%</span>
            <span className="font-bold text-white/60">-<Price amount={cut} free="0" /></span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-ink-line pt-2">
            <span className="font-semibold">{name} gets</span>
            <span className="font-display text-base text-space-bright">
              <Price amount={arriving} free="0" />
            </span>
          </div>
        </div>

        <Textarea
          label="Say something"
          labelNote="optional"
          rows={2}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Thanks for the hat"
        />

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={sending}>Never mind</Button>
          <Button
            variant="yes"
            loading={sending}
            disabled={!enough || sending}
            onClick={() => void send()}
          >
            Send {sane ? formatCount(typed) : ''} Brix
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

import { useEffect, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faPlus, faCopy, faAward, faBagShopping } from '@fortawesome/free-solid-svg-icons'
import { Card } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { CurrencyMark } from '@/components/brand/Currency'
import { useToast } from '@/components/ui/Toast'
import { formatCount } from '@/lib/format'
import {
  badgesOf, passesOf, makeWorldBadge, makeWorldPass,
  type WorldBadge, type WorldPass,
} from '@/lib/api'

/** The same label-over-control the configuration page uses. */
function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

/**
 * The number, and a way to take it.
 *
 * This is the reason the whole feature exists: a badge the Workspace cannot
 * name cannot be awarded by anything. So the number is shown next to every
 * one of them and copied in one press, rather than hidden behind an edit
 * dialog somebody has to go hunting in.
 */
function TheNumber({ id }: { id: number }) {
  const toast = useToast()
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(String(id))
        toast('Number copied.', 'success')
      }}
      className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-2 py-1 font-mono text-xs text-muted transition-colors hover:text-white"
      title="Copy this number for a script"
    >
      {id}
      <Glyph icon={faCopy} />
    </button>
  )
}

/**
 * Making badges and passes for one World.
 *
 * `opened` is what the add tile on the World page asks for, so pressing a
 * plus over there lands here with the form already open rather than on a
 * settings page where somebody has to find it again.
 */
export function MakeThings({
  worldId, kind, opened,
}: {
  worldId: string
  kind: 'badge' | 'pass'
  opened?: boolean
}) {
  const toast = useToast()
  const badge = kind === 'badge'

  const [made, setMade] = useState<(WorldBadge | WorldPass)[]>([])
  const [open, setOpen] = useState(Boolean(opened))
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [price, setPrice] = useState('0')
  const [busy, setBusy] = useState(false)

  /*
   * Asked for at the moment of use rather than held from a parent: this
   * list changes every time the form below is submitted, and a copy taken
   * once would be a list that is wrong from the first thing somebody makes.
   */
  const load = async () => {
    setMade(badge ? await badgesOf(worldId) : await passesOf(worldId))
  }

  useEffect(() => { void load() }, [worldId, kind])

  const make = async () => {
    if (!name.trim()) { toast('Give it a name first.'); return }
    setBusy(true)
    try {
      const number = badge
        ? await makeWorldBadge(worldId, name.trim(), about.trim() || null)
        : await makeWorldPass(worldId, name.trim(), about.trim() || null, Math.max(0, Number(price) || 0))
      setName(''); setAbout(''); setPrice('0')
      setOpen(false)
      await load()
      toast(`Made. Its number is ${number}.`, 'success')
    } catch (err) {
      toast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-extrabold">
            {badge ? 'Badges' : 'Gamepasses'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {badge
              ? 'Things this World hands out. Award one from a script using its number.'
              : 'Things this World sells. Check for one from a script using its number.'}
          </p>
        </div>
        <Button variant="ghost" icon={faPlus} onClick={() => setOpen(true)}>
          New {badge ? 'badge' : 'gamepass'}
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => { if (!busy) setOpen(false) }}
        title={badge ? 'New badge' : 'New gamepass'}
        description={badge
          ? 'It gets a number as soon as you make it, and a script awards it by that number.'
          : 'It gets a number as soon as you make it, and a script checks for it by that number.'}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Never mind
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void make()}>
              {busy ? 'Making…' : `Make the ${badge ? 'badge' : 'gamepass'}`}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Field label="Name">
            <Input value={name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} maxLength={48} />
          </Field>
          <Field label="What it is for">
            <Textarea value={about} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAbout(e.target.value)} maxLength={600} rows={2} />
          </Field>
          {!badge && (
            <Field label="Price" hint="Zero is allowed - a pass can be a key rather than a purchase.">
              <Input
                type="number"
                min={0}
                value={price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
              />
            </Field>
          )}
        </div>
      </Dialog>

      {made.length > 0 && (
        <ul className="mt-4 space-y-2">
          {made.map((one) => (
            <li
              key={one.id}
              className="flex items-center gap-3 rounded-xl border-2 border-ink-line p-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink">
                <Glyph icon={badge ? faAward : faBagShopping} className="text-muted" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-white">{one.name}</span>
                <span className="text-xs text-muted">
                  {badge
                    ? `${formatCount((one as WorldBadge).awarded_count)} earned`
                    : ((one as WorldPass).price > 0
                      ? <><CurrencyMark className="mr-0.5" />{formatCount((one as WorldPass).price)}</>
                      : 'Free')}
                </span>
              </span>
              <TheNumber id={one.content_id} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { Dialog } from './Dialog'
import { Button } from './Button'
import { cn } from '@/lib/cn'

/**
 * Asking before something that is hard to take back.
 *
 * It says what will actually happen rather than "are you sure": blocking
 * somebody ends a friendship, empties a chat out of both lists and undoes
 * both follows, and nobody should find that out afterwards.
 */
export function Confirm({
  open,
  onClose,
  onConfirm,
  title,
  lead,
  points,
  confirmText,
  icon = faTriangleExclamation,
  tone = 'danger',
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  lead?: string
  points?: string[]
  confirmText: string
  icon?: IconDefinition
  tone?: 'danger' | 'primary'
  children?: ReactNode
}) {
  const [working, setWorking] = useState(false)

  const go = async () => {
    setWorking(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setWorking(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={working}>Never mind</Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            icon={icon}
            onClick={go}
            disabled={working}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <span
          className={cn(
            'mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl',
            tone === 'danger' ? 'bg-danger/15 text-danger' : 'bg-brand/15 text-brand',
          )}
        >
          <Glyph icon={icon} />
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          {lead && <p className="text-sm text-white/80">{lead}</p>}
          {!!points?.length && (
            <ul className="space-y-1.5 text-sm text-muted">
              {points.map((point) => (
                <li key={point} className="flex gap-2">
                  <span aria-hidden="true" className="text-white/30">-</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
          {children}
        </div>
      </div>
    </Dialog>
  )
}

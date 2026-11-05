import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faCircleCheck, faCircleExclamation, faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

type ToastTone = 'success' | 'error' | 'info'
type Toast = { id: number; tone: ToastTone; message: string }

const icons = {
  success: faCircleCheck,
  error: faCircleExclamation,
  info: faCircleInfo,
}

/*
 * Only the icon carries the tone now. The card is inverted - white on the
 * dark interface, black in daylight - so `text-space-bright` and
 * `text-link`, both picked to glow on a dark card, are the two that stop
 * being readable the moment the card turns white. These three are the
 * solid brand colours, which hold on either.
 */
const tones: Record<ToastTone, string> = {
  success: 'text-space',
  error: 'text-danger',
  /* The brighter blue and not `brand`: deep Kobbleston blue on a black
     card in daylight is a dot nobody can see. */
  info: 'text-brand-bright',
}

const ToastContext = createContext<(message: string, tone?: ToastTone) => void>(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((all) => [...all, { id, tone, message }])
    window.setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), 4200)
  }, [])

  const value = useMemo(() => push, [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex animate-pop-in items-center gap-3 rounded-xl px-4 py-3 text-sm',
              /* No border: on an inverted card a line is either invisible
                 against the page or a second edge around the first. The
                 shadow is what lifts it instead, and it is a heavier one
                 than `shadow-pop` because a white card on a dark page has
                 no edge of its own to be found by. */
              'bg-toast text-toast-fg shadow-[0_8px_30px_rgba(0,0,0,0.45)]',
            )}
          >
            <Glyph icon={icons[t.tone]} className={tones[t.tone]} />
            <span className="font-semibold">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

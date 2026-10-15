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

const tones: Record<ToastTone, string> = {
  success: 'border-space/40 text-space-bright',
  error: 'border-danger/40 text-danger',
  info: 'border-brand/50 text-link',
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
              'pointer-events-auto flex animate-pop-in items-center gap-3 rounded-xl border bg-ink-card px-4 py-3 text-sm shadow-pop',
              tones[t.tone],
            )}
          >
            <Glyph icon={icons[t.tone]} />
            <span className="text-white/90">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

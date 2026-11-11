import type { ReactNode } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

const tones = {
  neutral: 'bg-white/[0.07] text-white/70 border-white/10',
  brand: 'bg-brand/20 text-link border-brand/40',
  space: 'bg-space/15 text-space-bright border-space/40',
  warm: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  // Red is danger and nothing else: a blocked word, a suspended account, a
  // thing that has been removed. Badge had no red, so those read as ordinary.
  danger: 'bg-danger-soft text-danger border-danger/40',
}

export function Badge({
  children,
  icon,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  icon?: IconDefinition
  tone?: keyof typeof tones
  className?: string
}) {
  return (
    <span
      className={cn(
        // `border-2` and a bolder weight, like everything else. Still a
        // pill: a chip is the one thing on the page that is not a block,
        // and keeping it round is what stops a row of them reading as more
        // buttons.
        'inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-[11px] font-bold',
        tones[tone],
        className,
      )}
    >
      {icon && <Glyph icon={icon} className="text-[10px]" />}
      {children}
    </span>
  )
}

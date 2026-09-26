import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Hop } from '@/components/ui/Hop'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/*
 * Green is a minority, on purpose.
 *
 * Staw's number is about thirty percent green, the rest blue, red only for
 * deleting, reporting, blocking and warning. The first attempt at "more
 * green" made `primary` green — and `primary` is the default, so every
 * button nobody thought about went green and the ratio came out the other
 * way round. Loud everywhere is the same as quiet everywhere.
 *
 * So: `primary` is blue again and stays the workhorse. `yes` is green and is
 * said on purpose — the one action a screen is for. Save, publish, upload,
 * accept, play. One per screen, usually; if two buttons on a screen are both
 * green, one of them is wrong.
 *
 * Blue is what you are standing inside, green is the answer that means yes,
 * red is danger and nothing else.
 */
type Variant = 'primary' | 'yes' | 'enter' | 'brand' | 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-bright active:bg-brand border-b-[3px] border-brand-ink active:border-b-0 active:mt-[3px]',
  /** The one thing this screen is for. Said on purpose, not by default. */
  yes:
    'bg-space text-white hover:bg-space-bright active:bg-space border-b-[3px] border-space-deep active:border-b-0 active:mt-[3px]',
  /** Going into a World, which is the loudest yes Kobblon has. */
  enter:
    'bg-space text-white hover:bg-space-bright active:bg-space border-b-[3px] border-space-deep active:border-b-0 active:mt-[3px]',
  /** The same blue as primary, kept for callers that name the platform. */
  brand:
    'bg-brand text-white hover:bg-brand-bright active:bg-brand border-b-[3px] border-brand-ink active:border-b-0 active:mt-[3px]',
  ghost:
    'bg-transparent text-white/80 hover:bg-white/10 hover:text-white border border-transparent',
  subtle:
    'bg-ink-hover text-white hover:bg-[#2c2c36] border border-ink-line',
  danger:
    'bg-danger/15 text-danger hover:bg-danger/25 border border-danger/40 font-bold',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
}

const base =
  'inline-flex items-center justify-center font-semibold transition-[background-color,transform,box-shadow] duration-150 ' +
  'active:translate-y-px disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: IconDefinition
  iconRight?: IconDefinition
  loading?: boolean
  to?: string
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, to, block, className, children, ...props },
  ref,
) {
  const classes = cn(base, variants[variant], sizes[size], block && 'w-full', className)
  const inner = (
    <>
      {loading ? (
        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
      ) : (
        icon && <FontAwesomeIcon icon={icon} />
      )}
      {children}
      {iconRight && !loading && <FontAwesomeIcon icon={iconRight} />}
    </>
  )

  if (to) {
    return (
      <Hop to={to} className={classes}>
        {inner}
      </Hop>
    )
  }

  return (
    <button ref={ref} className={classes} disabled={loading || props.disabled} {...props}>
      {inner}
    </button>
  )
})

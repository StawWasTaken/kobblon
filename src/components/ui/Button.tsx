import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/*
 * `primary` is green, and that is the whole of the change Staw asked for.
 *
 * It used to be blue, and because it is also the default, every button
 * nobody labelled came out blue — which is how a platform whose rule says
 * "green is yes" ended up looking like a bank. Nothing had to say
 * `variant="primary"` for that to happen; it happened by omission, which is
 * the only way a default ever goes wrong.
 *
 * Green now means the thing you came to this screen to do: save, publish,
 * upload, accept, play. That is an answer meaning yes, which is exactly what
 * the rule always said green was for. Blue stays the platform — the chrome,
 * the links, the marks — and `brand` is for the rare button that *is*
 * Kobblon rather than an action: signing in, a mark of the platform itself.
 */
type Variant = 'primary' | 'brand' | 'enter' | 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-space text-white hover:bg-space-bright active:bg-space border-b-[3px] border-space-deep active:border-b-0 active:mt-[3px]',
  brand:
    'bg-brand text-white hover:bg-brand-bright active:bg-brand border-b-[3px] border-brand-ink active:border-b-0 active:mt-[3px]',
  /*
   * Going into a World. The same green as primary on purpose: it is the
   * loudest yes Kobblon has, and it reads as the same promise as every other
   * green button rather than a special case somebody has to learn.
   */
  enter:
    'bg-space text-white hover:bg-space-bright active:bg-space border-b-[3px] border-space-deep active:border-b-0 active:mt-[3px]',
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
      <Link to={to} className={classes}>
        {inner}
      </Link>
    )
  }

  return (
    <button ref={ref} className={classes} disabled={loading || props.disabled} {...props}>
      {inner}
    </button>
  )
})

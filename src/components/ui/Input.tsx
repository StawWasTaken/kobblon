import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { cn } from '@/lib/cn'

const field =
  'w-full rounded-xl border border-ink-line bg-ink-raised px-3.5 py-2.5 text-sm text-white ' +
  'placeholder:text-white/30 transition-colors focus:border-brand-bright focus:bg-ink-hover'

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  labelNote?: string
  hint?: string
  error?: string | null
  icon?: IconDefinition
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, labelNote, hint, error, icon, className, id, ...props },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-muted">
          {label}
          {labelNote && <span className="ml-1.5 font-medium normal-case text-white/30">{labelNote}</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <FontAwesomeIcon
            icon={icon}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-white/35"
          />
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${inputId}-desc` : undefined}
          className={cn(field, icon && 'pl-10', error && 'border-danger/60', className)}
          {...props}
        />
      </div>
      {(error || hint) && (
        <p id={`${inputId}-desc`} className={cn('mt-1.5 text-xs', error ? 'text-danger' : 'text-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  )
})

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string
  labelNote?: string
  hint?: string
  error?: string | null
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, labelNote, hint, error, className, id, ...props },
  ref,
) {
  const generated = useId()
  const inputId = id ?? generated
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block font-display text-xs font-bold uppercase tracking-wide text-muted">
          {label}
          {labelNote && <span className="ml-1.5 font-medium normal-case text-white/30">{labelNote}</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(field, 'min-h-[92px] resize-y', error && 'border-danger/60', className)}
        {...props}
      />
      {(error || hint) && (
        <p className={cn('mt-1.5 text-xs', error ? 'text-danger' : 'text-muted')}>{error ?? hint}</p>
      )}
    </div>
  )
})

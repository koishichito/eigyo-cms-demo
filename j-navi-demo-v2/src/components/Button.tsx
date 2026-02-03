import { clsx } from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant
    leftIcon?: ReactNode
  },
) {
  const variant = props.variant ?? 'primary'
  const { className, leftIcon, ...rest } = props

  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'primary' &&
          'bg-[var(--jnavi-navy)] text-white hover:brightness-110',
        variant === 'secondary' &&
          'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
        variant === 'ghost' && 'text-slate-700 hover:bg-slate-100',
        className,
      )}
    >
      {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
      {props.children}
    </button>
  )
}

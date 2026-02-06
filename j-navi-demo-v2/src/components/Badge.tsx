import { clsx } from 'clsx'
import type { ReactNode } from 'react'

type Tone = 'slate' | 'green' | 'emerald' | 'amber' | 'blue'

const toneClass: Record<Tone, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
}

export function Badge(props: {
  children: ReactNode
  tone?: Tone
  className?: string
}) {
  const tone = props.tone ?? 'slate'
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium',
        toneClass[tone],
        props.className,
      )}
    >
      {props.children}
    </span>
  )
}

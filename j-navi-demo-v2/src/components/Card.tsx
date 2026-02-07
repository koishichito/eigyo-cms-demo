import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export function Card(props: { children: ReactNode; className?: string; title?: string; subtitle?: string }) {
  return (
    <div
      className={clsx(
        'rounded-xl border border-slate-200 bg-white shadow-sm',
        props.className,
      )}
    >
      {props.title ? (
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="text-sm font-semibold text-slate-900">{props.title}</div>
          {props.subtitle ? (
            <div className="mt-1 text-xs text-slate-500">{props.subtitle}</div>
          ) : null}
        </div>
      ) : null}
      <div className="px-5 py-4">{props.children}</div>
    </div>
  )
}

export function CardHeader(props: {
  title: string
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        {props.subtitle ? (
          <div className="mt-1 text-xs text-slate-500">{props.subtitle}</div>
        ) : null}
      </div>
      {props.right ? <div className="shrink-0">{props.right}</div> : null}
    </div>
  )
}

export function CardBody(props: { children: ReactNode; className?: string }) {
  return <div className={clsx('px-5 py-4', props.className)}>{props.children}</div>
}

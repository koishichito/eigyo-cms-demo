import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

export function Modal(props: {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!props.open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [props.open, props.onClose])

  if (!props.open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
    >
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={props.onClose}
      />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <div className="text-base font-semibold text-slate-900">
              {props.title}
            </div>
            {props.description ? (
              <div className="mt-1 text-sm text-slate-500">
                {props.description}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="閉じる"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {props.children}
        </div>

        {props.footer ? (
          <div className="border-t border-slate-100 px-5 py-4">
            {props.footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

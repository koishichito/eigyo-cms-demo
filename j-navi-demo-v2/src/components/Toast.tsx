import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react'
import { clsx } from 'clsx'

type ToastTone = 'success' | 'info' | 'error'

type ToastItem = {
  id: string
  message: string
  tone: ToastTone
}

type ToastApi = {
  push: (message: string, tone?: ToastTone) => void
  show: (message: string, tone?: ToastTone) => void
  success: (message: string) => void
  info: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

function iconFor(tone: ToastTone) {
  if (tone === 'success') return <CheckCircle2 size={18} className="text-emerald-600" />
  if (tone === 'error') return <AlertTriangle size={18} className="text-rose-600" />
  return <Info size={18} className="text-blue-600" />
}

export function ToastProvider(props: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
      const item: ToastItem = { id, message, tone }
      setToasts((prev) => [item, ...prev].slice(0, 4))

      window.setTimeout(() => remove(id), 3500)
    },
    [remove],
  )

  const api = useMemo<ToastApi>(
    () => ({
      push,
      show: push,
      success: (m) => push(m, 'success'),
      info: (m) => push(m, 'info'),
      error: (m) => push(m, 'error'),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={api}>
      {props.children}

      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-white p-3 shadow-lg',
              t.tone === 'success' && 'border-emerald-200',
              t.tone === 'info' && 'border-slate-200',
              t.tone === 'error' && 'border-rose-200',
            )}
          >
            <div className="mt-0.5">{iconFor(t.tone)}</div>
            <div className="flex-1">
              <div className="text-sm font-medium text-slate-900">{t.message}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                J-Navi
              </div>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              onClick={() => remove(t.id)}
              aria-label="閉じる"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

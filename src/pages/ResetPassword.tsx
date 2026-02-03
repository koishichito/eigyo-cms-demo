import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ToastProvider, useToast } from '../components/Toast'
import { useDb } from '../state/DbProvider'

function ResetInner() {
  const { actions } = useDb()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  const token = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return sp.get('token') ?? ''
  }, [location.search])

  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')

  return (
    <div className="mx-auto max-w-md">
      <Card title="新しいパスワードを設定" subtitle="再設定リンクのトークンを使用します（デモ）">
        <div className="grid gap-3">
          <div className="text-xs text-slate-500">
            token: <span className="font-mono">{token || '(なし)'}</span>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-700">新しいパスワード</span>
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              placeholder="8文字以上"
              type="password"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-700">新しいパスワード（確認）</span>
            <input
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              placeholder="同じものを入力"
              type="password"
            />
          </label>

          <Button
            variant="primary"
            onClick={() => {
              if (pw !== pw2) {
                toast.show('パスワードが一致しません', 'error')
                return
              }
              const res = actions.resetPassword(token, pw)
              if (!res.ok) {
                toast.show(res.message ?? '失敗しました', 'error')
                return
              }
              toast.show('パスワードを再設定しました。ログインしてください。', 'success')
              navigate('/login')
            }}
          >
            再設定
          </Button>

          <div className="text-sm">
            <Link to="/login" className="text-blue-600 hover:underline">
              ログインへ
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <ToastProvider>
      <ResetInner />
    </ToastProvider>
  )
}

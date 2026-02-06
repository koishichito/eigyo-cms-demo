import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ToastProvider, useToast } from '../components/Toast'
import { useDb } from '../state/DbProvider'

function ForgotInner() {
  const { actions } = useDb()
  const toast = useToast()
  const [email, setEmail] = useState('')

  return (
    <div className="mx-auto max-w-md">
      <Card title="パスワード再設定" subtitle="登録メール宛に再設定リンク（デモ）を送信します">
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-700">メールアドレス</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              placeholder="you@example.com"
              type="email"
            />
          </label>

          <Button
            variant="primary"
            onClick={async () => {
              await actions.requestPasswordReset(email)
              toast.show('再設定メールを送信しました（該当アカウントがある場合）', 'success')
            }}
          >
            送信
          </Button>

          <div className="text-sm text-slate-600">
            <div>
              <Link to="/outbox" className="text-blue-600 hover:underline">
                デモメールボックス（Outbox）
              </Link>
              に再設定リンクが届きます。
            </div>
            <div className="mt-2">
              <Link to="/login" className="text-blue-600 hover:underline">
                ログインへ戻る
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <ToastProvider>
      <ForgotInner />
    </ToastProvider>
  )
}

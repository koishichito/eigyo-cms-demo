import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ToastProvider, useToast } from '../components/Toast'
import { useDb, getRoleHomePath, getSessionUser } from '../state/DbProvider'

function LoginInner() {
  const { db, actions } = useDb()
  const toast = useToast()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const already = getSessionUser(db)

  return (
    <div className="mx-auto max-w-md">
      <Card title="ログイン" subtitle="Jnavi 営業マッチングプラットフォーム（デモ）">
        {already ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            既にログイン中です（{already.email}）
            <div className="mt-2">
              <Button onClick={() => navigate(getRoleHomePath(already))} variant="primary">
                ホームへ
              </Button>
            </div>
          </div>
        ) : null}

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

          <label className="grid gap-1 text-sm">
            <span className="text-slate-700">パスワード</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              placeholder="••••••••"
              type="password"
            />
          </label>

          <Button
            variant="primary"
            onClick={() => {
              const res = actions.login(email, password)
              if (!res.ok) {
                toast.show(res.message ?? 'ログインに失敗しました', 'error')
                return
              }
              const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
              navigate(user ? getRoleHomePath(user) : '/dashboard')
            }}
          >
            ログイン
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot" className="text-blue-600 hover:underline">
              パスワードを忘れた
            </Link>
            <Link to="/join" className="text-blue-600 hover:underline">
              コネクター登録
            </Link>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <div className="font-semibold text-slate-700">デモ用ログイン</div>
            <ul className="mt-2 list-disc pl-5">
              <li>運営: admin@j-navi.test / admin123</li>
              <li>代理店A: agencyA@j-navi.test / agency123</li>
              <li>代理店B: agencyB@j-navi.test / agency123</li>
              <li>コネクターA: connectorA@j-navi.test / connector123</li>
              <li>コネクターB: connectorB@j-navi.test / connector123</li>
              <li>コネクターC: connectorC@j-navi.test / connector123</li>
            </ul>
            <div className="mt-2">
              <Link to="/outbox" className="text-blue-600 hover:underline">
                デモメールボックス（Outbox）
              </Link>
            </div>
            <div className="mt-2 text-[11px] text-slate-500">
              ※構造は「Jnavi運営 → 代理店 → コネクター」の<strong>3層のみ</strong>。MLMツリーはありません。
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <ToastProvider>
      <LoginInner />
    </ToastProvider>
  )
}

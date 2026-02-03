import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ToastProvider, useToast } from '../components/Toast'
import { useDb } from '../state/DbProvider'
import { agencies } from '../state/selectors'

function JoinInner() {
  const { db, actions } = useDb()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()

  const inviteCode = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return sp.get('code') ?? ''
  }, [location.search])

  const agencyList = useMemo(() => agencies(db), [db])

  const inviterAgency = useMemo(() => {
    const code = inviteCode.trim().toUpperCase()
    if (!code) return null
    return (
      db.users.find((u) => u.role === '代理店' && (u.agency?.inviteCode ?? '').toUpperCase() === code) ?? null
    )
  }, [db.users, inviteCode])

  const [agencyId, setAgencyId] = useState<string>('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')

  useEffect(() => {
    // inviteCode が有効で、まだ代理店未選択の場合は自動でセット
    if (!agencyId && inviterAgency?.id) setAgencyId(inviterAgency.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviterAgency?.id])

  const canRegister = !!agencyId && !!name && !!email && pw.length >= 8 && pw === pw2

  return (
    <div className="mx-auto max-w-md">
      <Card title="コネクター登録" subtitle="代理店に所属して登録（Phase 1 デモ）">
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-700">招待コード（任意）</span>
            <input
              value={inviteCode}
              onChange={(e) => {
                const sp = new URLSearchParams(location.search)
                sp.set('code', e.target.value)
                navigate({ pathname: '/join', search: sp.toString() }, { replace: true })
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono"
              placeholder="例: AG-A123"
            />
          </label>

          {inviteCode ? (
            inviterAgency ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                紹介代理店: <span className="font-semibold">{inviterAgency.name}</span>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                この招待コードは見つかりません（コードなしでも登録できます）。
              </div>
            )
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              招待リンクの <span className="font-mono">code</span> 付きURLから開くと自動入力されます。
            </div>
          )}

          <label className="grid gap-1 text-sm">
            <span className="text-slate-700">所属代理店（必須）</span>
            <select
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">選択してください</option>
              {agencyList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="text-slate-700">氏名</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                placeholder="山田 太郎"
              />
            </label>
            <label className="grid gap-1 text-sm md:col-span-2">
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
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                placeholder="8文字以上"
                type="password"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-700">確認</span>
              <input
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                placeholder="同じものを入力"
                type="password"
              />
            </label>
          </div>

          <Button
            variant="primary"
            disabled={!canRegister}
            onClick={() => {
              if (!agencyId) {
                toast.show('所属代理店を選択してください', 'error')
                return
              }
              if (pw !== pw2) {
                toast.show('パスワードが一致しません', 'error')
                return
              }
              const res = actions.registerConnector({
                agencyId,
                introducedById: inviterAgency?.id,
                name,
                email,
                password: pw,
              })
              if (!res.ok) {
                toast.show(res.message ?? '登録できませんでした', 'error')
                return
              }
              toast.show('登録しました。ログインしました。', 'success')
              navigate('/')
            }}
          >
            登録する
          </Button>

          <div className="text-sm text-slate-600">
            <Link to="/login" className="text-blue-600 hover:underline">
              ログインへ
            </Link>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            ※この画面では <span className="font-semibold">コネクターのみ</span> を登録します。代理店アカウントは運営側で発行します。
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function JoinPage() {
  return (
    <ToastProvider>
      <JoinInner />
    </ToastProvider>
  )
}

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ToastProvider, useToast } from '../components/Toast'
import { useDb } from '../state/DbProvider'
import { getCurrentUser } from '../state/selectors'
import type { BankAccount } from '../state/types'

function SettingsInner() {
  const { db, actions } = useDb()
  const me = getCurrentUser(db)
  const toast = useToast()

  const [name, setName] = useState(me.name)
  const [email, setEmail] = useState(me.email)

  const [bank, setBank] = useState<BankAccount | undefined>(me.bankAccount)

  const [curPw, setCurPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPw2, setNewPw2] = useState('')

  const canBank = me.role === '代理店' || me.role === 'コネクター'

  return (
    <div className="grid gap-6">
      <Card title="設定" subtitle="プロフィール / パスワード / デモ操作">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">プロフィール</div>
            <div className="mt-3 grid gap-2 text-sm">
              <label className="grid gap-1">
                <span className="text-slate-700">氏名</span>
                <input
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-slate-700">メール</span>
                <input
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                />
              </label>

              {canBank ? (
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs font-semibold text-slate-700">振込口座（代理店/コネクター）</div>
                  <div className="mt-2 grid gap-2">
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">銀行名</span>
                        <input
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                          value={bank?.bankName ?? ''}
                          onChange={(e) => setBank({ ...(bank ?? emptyBank()), bankName: e.target.value })}
                        />
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">支店名</span>
                        <input
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                          value={bank?.branchName ?? ''}
                          onChange={(e) => setBank({ ...(bank ?? emptyBank()), branchName: e.target.value })}
                        />
                      </label>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">種別</span>
                        <select
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                          value={bank?.accountType ?? '普通'}
                          onChange={(e) =>
                            setBank({ ...(bank ?? emptyBank()), accountType: e.target.value as any })
                          }
                        >
                          <option value="普通">普通</option>
                          <option value="当座">当座</option>
                        </select>
                      </label>
                      <label className="grid gap-1 text-sm">
                        <span className="text-slate-700">口座番号</span>
                        <input
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                          value={bank?.accountNumber ?? ''}
                          onChange={(e) => setBank({ ...(bank ?? emptyBank()), accountNumber: e.target.value })}
                        />
                      </label>
                    </div>
                    <label className="grid gap-1 text-sm">
                      <span className="text-slate-700">口座名義</span>
                      <input
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                        value={bank?.accountHolder ?? ''}
                        onChange={(e) => setBank({ ...(bank ?? emptyBank()), accountHolder: e.target.value })}
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <div className="mt-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    const res = actions.updateMyProfile({ name, email, bankAccount: bank })
                    if (!res.ok) toast.show(res.message ?? '更新できませんでした', 'error')
                    else toast.show('更新しました', 'success')
                  }}
                >
                  保存
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">パスワード変更</div>
            <div className="mt-3 grid gap-2 text-sm">
              <label className="grid gap-1">
                <span className="text-slate-700">現在のパスワード</span>
                <input
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  value={curPw}
                  onChange={(e) => setCurPw(e.target.value)}
                  type="password"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-slate-700">新しいパスワード</span>
                <input
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  type="password"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-slate-700">新しいパスワード（確認）</span>
                <input
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  value={newPw2}
                  onChange={(e) => setNewPw2(e.target.value)}
                  type="password"
                />
              </label>

              <Button
                variant="primary"
                onClick={() => {
                  if (newPw !== newPw2) {
                    toast.show('新しいパスワードが一致しません', 'error')
                    return
                  }
                  const res = actions.changePassword(curPw, newPw)
                  if (!res.ok) toast.show(res.message ?? '変更できませんでした', 'error')
                  else {
                    toast.show('変更しました', 'success')
                    setCurPw('')
                    setNewPw('')
                    setNewPw2('')
                  }
                }}
              >
                変更
              </Button>

              <div className="text-xs text-slate-500">
                パスワードはデモでも bcrypt でハッシュ化して保存しています（localStorage）。
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">デモ操作</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              onClick={() => {
                actions.resetAll()
                toast.show('デモデータを初期化しました', 'success')
              }}
            >
              デモデータ初期化
            </button>
            <Link to="/outbox" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">
              Outboxを見る
            </Link>
          </div>
          <div className="mt-2 text-xs text-slate-600">
            ※本番では「データ初期化」やOutbox表示は存在しません。
          </div>
        </div>
      </Card>
    </div>
  )
}

function emptyBank(): BankAccount {
  return {
    bankName: '',
    branchName: '',
    accountType: '普通',
    accountNumber: '',
    accountHolder: '',
  }
}

export default function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsInner />
    </ToastProvider>
  )
}

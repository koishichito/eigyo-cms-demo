import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { ToastProvider, useToast } from '../../components/Toast'
import { useDb } from '../../state/DbProvider'
import { findUser, getCurrentUser } from '../../state/selectors'
import { formatJPY } from '../../utils/format'

function AdminPayoutsInner() {
  const { db, actions } = useDb()
  const toast = useToast()
  if (!db) return null
  const me = getCurrentUser(db)

  if (me.role !== 'J-Navi管理者') {
    return (
      <Card title="出金申請（運営）" subtitle="このページはJnavi運営向けです">
        <div className="text-sm text-slate-600">権限がありません。</div>
      </Card>
    )
  }

  const requests = db.payoutRequests

  return (
    <Card title="出金申請（運営）" subtitle="申請中 → 支払済み へ更新します">
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">申請ID</th>
              <th className="px-3 py-2">申請者（代理店/コネクター）</th>
              <th className="px-3 py-2">申請日</th>
              <th className="px-3 py-2">金額</th>
              <th className="px-3 py-2">状態</th>
              <th className="px-3 py-2">口座</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((p) => {
              const user = findUser(db, p.userId)
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">{p.id}</td>
                  <td className="px-3 py-2">
                    <div className="text-slate-900">{user?.name ?? p.userId}</div>
                    <div className="text-xs text-slate-500">
                      {user?.role ? `${user.role} / ` : ''}
                      {user?.email}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{new Date(p.requestedAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{formatJPY(p.amountJPY)}</td>
                  <td className="px-3 py-2">{p.status}</td>
                  <td className="px-3 py-2">
                    {user?.bankAccount ? (
                      <div className="text-xs text-slate-700">
                        {user.bankAccount.bankName} {user.bankAccount.branchName} / {user.bankAccount.accountType}{' '}
                        {user.bankAccount.accountNumber}
                        <div className="text-slate-500">{user.bankAccount.accountHolder}</div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400">未登録</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {p.status === '申請中' ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={async () => {
                          const res = await actions.adminMarkPayoutPaid(p.id)
                          if (!res.ok) toast.show(res.message ?? '更新できませんでした', 'error')
                          else toast.show('支払済みにしました', 'success')
                        }}
                      >
                        支払済みにする
                      </Button>
                    ) : (
                      <div className="text-xs text-slate-500">
                        {p.processedAt ? new Date(p.processedAt).toLocaleString() : ''}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {requests.length === 0 ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          出金申請がありません。
        </div>
      ) : null}
    </Card>
  )
}

export default function AdminPayoutsPage() {
  return (
    <ToastProvider>
      <AdminPayoutsInner />
    </ToastProvider>
  )
}

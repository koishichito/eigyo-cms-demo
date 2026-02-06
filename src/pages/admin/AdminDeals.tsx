import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { ToastProvider, useToast } from '../../components/Toast'
import { useDb } from '../../state/DbProvider'
import { findProduct, findUser, getCurrentUser } from '../../state/selectors'
import { formatDateYMD, formatJPY } from '../../utils/format'

function AdminDealsInner() {
  const { db, actions } = useDb()
  const toast = useToast()
  if (!db) return null
  const me = getCurrentUser(db)

  if (me.role !== 'J-Navi管理者') {
    return (
      <Card title="商談/取引（運営）" subtitle="このページはJnavi運営向けです">
        <div className="text-sm text-slate-600">権限がありません。</div>
      </Card>
    )
  }

  const openDeals = useMemo(() => db.deals.filter((d) => !d.locked && d.status !== '失注'), [db.deals])
  const transactions = useMemo(() => [...db.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.transactions])

  return (
    <div className="space-y-6">
      <Card title="進行中の商談" subtitle="リード〜契約の進捗を確認します">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">商談ID</th>
                <th className="px-3 py-2">商材</th>
                <th className="px-3 py-2">顧客</th>
                <th className="px-3 py-2">ステータス</th>
                <th className="px-3 py-2">コネクター</th>
                <th className="px-3 py-2">代理店</th>
              </tr>
            </thead>
            <tbody>
              {openDeals.map((d) => {
                const p = findProduct(db, d.productId)
                const connector = findUser(db, d.connectorId)
                const agency = connector?.connector?.agencyId ? findUser(db, connector.connector.agencyId) : undefined
                return (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{d.id}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900">{p?.name ?? d.productId}</div>
                      <div className="text-xs text-slate-500">{p?.category}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="text-slate-900">{d.customerCompanyName}</div>
                      <div className="text-xs text-slate-500">{d.contactName}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone="amber">{d.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-700">{connector?.name ?? d.connectorId}</td>
                    <td className="px-3 py-2 text-sm text-slate-700">{agency?.name ?? '-'}</td>
                  </tr>
                )
              })}
              {openDeals.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-sm text-slate-500" colSpan={6}>
                    進行中の商談はありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title="売上確定/取引（配分内訳）"
        subtitle="『代理店15%』『コネクター5%』の内訳を明記します。監査ログも残ります。"
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">取引ID</th>
                <th className="px-3 py-2">案件</th>
                <th className="px-3 py-2">報酬計算対象額</th>
                <th className="px-3 py-2">代理店15%</th>
                <th className="px-3 py-2">コネクター5%</th>
                <th className="px-3 py-2">Jnavi取り分</th>
                <th className="px-3 py-2">状態</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const agency = findUser(db, t.agencyId)
                const connector = findUser(db, t.connectorId)

                const agencyAlloc = t.allocations.find(
                  (a) => a.recipientType === 'ユーザー報酬' && a.userRole === '代理店'
                )
                const connectorAlloc = t.allocations.find(
                  (a) => a.recipientType === 'ユーザー報酬' && a.userRole === 'コネクター'
                )
                const jnavi = t.allocations.find((a) => a.recipientType === 'Jnavi取り分')

                const hasPending = t.allocations.some((a) => a.recipientType === 'ユーザー報酬' && a.status === '未確定')

                return (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs">{t.id}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900">{t.productSnapshot.name}</div>
                      <div className="text-xs text-slate-500">
                        案件: {t.dealId} / 売上確定日: {formatDateYMD(t.closingDate)}
                      </div>
                      <div className="text-xs text-slate-500">
                        代理店: {agency?.name ?? t.agencyId} / コネクター: {connector?.name ?? t.connectorId}
                      </div>
                    </td>
                    <td className="px-3 py-2">{formatJPY(t.baseAmountJPY)}</td>
                    <td className="px-3 py-2">
                      <div>{formatJPY(t.agencyRewardJPY)}</div>
                      <div className="text-xs text-slate-500">(15%)</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{formatJPY(t.connectorRewardJPY)}</div>
                      <div className="text-xs text-slate-500">(5%)</div>
                    </td>
                    <td className="px-3 py-2">{formatJPY(t.jnaviShareJPY)}</td>
                    <td className="px-3 py-2">
                      {hasPending ? <Badge tone="amber">未確定あり</Badge> : <Badge tone="green">確定</Badge>}
                      <div className="mt-1 text-xs text-slate-500">
                        {agencyAlloc?.status ?? '-'} / {connectorAlloc?.status ?? '-'}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {hasPending ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={async () => {
                            const res = await actions.adminConfirmRewardsForTransaction(t.id)
                            if (!res.ok) toast.show(res.message ?? '更新できませんでした', 'error')
                            else toast.show('報酬を確定にしました', 'success')
                          }}
                        >
                          報酬を確定にする
                        </Button>
                      ) : (
                        <div className="text-xs text-slate-500">
                          <Link to="/admin/logs" className="text-blue-600 hover:underline">
                            監査ログ
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {transactions.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-sm text-slate-500" colSpan={8}>
                    取引データがありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="font-semibold">監査ポイント</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
            <li>
              各案件（dealId）に対し「代理店15%」「コネクター5%」の配分がテーブル上に明記されます。
            </li>
            <li>同内容のログは「監査ログ」画面にも残ります。</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}

export default function AdminDealsPage() {
  return (
    <ToastProvider>
      <AdminDealsInner />
    </ToastProvider>
  )
}

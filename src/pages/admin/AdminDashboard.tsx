import { useMemo } from 'react'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { useDb } from '../../state/DbProvider'
import { getCurrentUser } from '../../state/selectors'
import { formatJPY } from '../../utils/format'

function groupLabel(type: string): string {
  switch (type) {
    case 'signage':
      return '窓ガラスサイネージ'
    case 'hotel_membership':
      return 'JNホテル会員権'
    case 'ad_slot':
      return '広告枠'
    default:
      return type
  }
}

export default function AdminDashboardPage() {
  const { db } = useDb()
  if (!db) return null
  const me = getCurrentUser(db)

  if (me.role !== 'J-Navi管理者') {
    return (
      <Card title="統合ダッシュボード" subtitle="このページはJnavi運営向けです">
        <div className="text-sm text-slate-600">権限がありません。</div>
      </Card>
    )
  }

  const counts = useMemo(() => {
    const agencies = db.users.filter((u) => u.role === '代理店').length
    const connectors = db.users.filter((u) => u.role === 'コネクター').length
    const openDeals = db.deals.filter((d) => !d.locked && d.status !== '失注').length
    const closedDeals = db.deals.filter((d) => d.locked).length
    return { agencies, connectors, openDeals, closedDeals }
  }, [db.users, db.deals])

  const totals = useMemo(() => {
    let totalSales = 0
    let totalAgency = 0
    let totalConnector = 0
    let totalJnavi = 0
    let pendingRewards = 0

    const byProduct: Record<string, { sales: number; agency: number; connector: number; jnavi: number }> = {}

    db.transactions.forEach((t) => {
      totalSales += t.saleAmountJPY
      const key = t.productSnapshot.type
      if (!byProduct[key]) byProduct[key] = { sales: 0, agency: 0, connector: 0, jnavi: 0 }
      byProduct[key].sales += t.saleAmountJPY

      t.allocations.forEach((a) => {
        if (a.recipientType === 'Jnavi取り分') {
          totalJnavi += a.amountJPY
          byProduct[key].jnavi += a.amountJPY
        }
        if (a.recipientType === 'ユーザー報酬') {
          if (a.userRole === '代理店') {
            totalAgency += a.amountJPY
            byProduct[key].agency += a.amountJPY
          } else {
            totalConnector += a.amountJPY
            byProduct[key].connector += a.amountJPY
          }
          if (a.status === '未確定') pendingRewards += a.amountJPY
        }
      })
    })

    return { totalSales, totalAgency, totalConnector, totalJnavi, pendingRewards, byProduct }
  }, [db.transactions])

  return (
    <div className="space-y-6">
      <Card title="統合ダッシュボード" subtitle="3商材の売上・報酬総額を1画面で確認できます">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">総売上（売上確定分）</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{formatJPY(totals.totalSales)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">代理店報酬 合計（10%）</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{formatJPY(totals.totalAgency)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">コネクター報酬 合計（5%）</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{formatJPY(totals.totalConnector)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Jnavi取り分（残余）</div>
            <div className="mt-1 text-xl font-semibold text-slate-900">{formatJPY(totals.totalJnavi)}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
          <span className="inline-flex items-center gap-1">
            <Badge tone="blue">代理店</Badge> {counts.agencies}社
          </span>
          <span className="inline-flex items-center gap-1">
            <Badge tone="green">コネクター</Badge> {counts.connectors}人
          </span>
          <span className="inline-flex items-center gap-1">
            <Badge tone="amber">進行中</Badge> {counts.openDeals}件
          </span>
          <span className="inline-flex items-center gap-1">
            <Badge tone="slate">売上確定</Badge> {counts.closedDeals}件
          </span>
          <span className="inline-flex items-center gap-1">
            <Badge tone="amber">未確定報酬</Badge> {formatJPY(totals.pendingRewards)}
          </span>
        </div>
      </Card>

      <Card title="商材別サマリー" subtitle="サイネージ・ホテル・広告の3商材を並列で表示します">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">商材</th>
                <th className="px-3 py-2">売上</th>
                <th className="px-3 py-2">代理店10%</th>
                <th className="px-3 py-2">コネクター5%</th>
                <th className="px-3 py-2">Jnavi取り分</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(totals.byProduct).map(([k, v]) => (
                <tr key={k} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-semibold text-slate-900">{groupLabel(k)}</td>
                  <td className="px-3 py-2">{formatJPY(v.sales)}</td>
                  <td className="px-3 py-2">{formatJPY(v.agency)}</td>
                  <td className="px-3 py-2">{formatJPY(v.connector)}</td>
                  <td className="px-3 py-2">{formatJPY(v.jnavi)}</td>
                </tr>
              ))}
              {Object.keys(totals.byProduct).length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-sm text-slate-500" colSpan={5}>
                    まだ売上確定データがありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

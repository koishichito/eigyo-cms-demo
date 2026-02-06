import { Link } from 'react-router-dom'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { useDb } from '../state/DbProvider'
import { connectorsForAgency, getCurrentUser, sumAgencyRewards, sumAgencyTeamSales, sumConnectorRewards, sumConnectorSales, sumUserRewards } from '../state/selectors'
import { formatJPY } from '../utils/format'

export default function DashboardPage() {
  const { db } = useDb()
  const me = getCurrentUser(db)

  if (!(me.role === '代理店' || me.role === 'コネクター')) {
    return (
      <Card title="ホーム" subtitle="このページは代理店/コネクター向けです">
        <div className="text-sm text-slate-600">サイドバーから該当メニューへ移動してください。</div>
      </Card>
    )
  }

  const myPending = sumUserRewards(db, me.id, '未確定')
  const myConfirmed = sumUserRewards(db, me.id, '確定')
  const myPaid = sumUserRewards(db, me.id, '支払済み')

  const openDeals =
    me.role === 'コネクター'
      ? db.deals.filter((d) => d.connectorId === me.id && !d.locked && d.status !== '失注').length
      : db.deals.filter((d) => {
          if (d.locked) return false
          if (d.status === '失注') return false
          const c = db.users.find((u) => u.id === d.connectorId)
          return c?.connector?.agencyId === me.id
        }).length

  const teamCount = me.role === '代理店' ? connectorsForAgency(db, me.id).length : undefined

  const headline = me.role === '代理店' ? `ようこそ、${me.name}（代理店）` : `ようこそ、${me.name}（コネクター）`

  return (
    <div className="grid gap-6">
      <Card title={headline} subtitle="3層フラット構造 / 固定報酬（代理店15%・コネクター5%）">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">未確定報酬</div>
            <div className="mt-1 text-2xl font-semibold">{formatJPY(myPending)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">確定報酬</div>
            <div className="mt-1 text-2xl font-semibold">{formatJPY(myConfirmed)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">支払済み</div>
            <div className="mt-1 text-2xl font-semibold">{formatJPY(myPaid)}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">進行中の商談</div>
            <div className="mt-1 text-2xl font-semibold">{openDeals}件</div>
          </div>
        </div>

        {me.role === '代理店' ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">チーム実績</div>
                <div className="text-xs text-slate-600">配下コネクター数: {teamCount}</div>
              </div>
              <Badge tone="slate">代理店報酬 15%</Badge>
            </div>
            <div className="mt-3 grid gap-1 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">チーム売上合計</span>
                <span className="font-semibold">{formatJPY(sumAgencyTeamSales(db, me.id))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">あなたの代理店報酬累計</span>
                <span className="font-semibold">{formatJPY(sumAgencyRewards(db, me.id))}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">あなたの実績</div>
                <div className="text-xs text-slate-600">（自分の活動のみ閲覧可）</div>
              </div>
              <Badge tone="slate">コネクター報酬 5%</Badge>
            </div>
            <div className="mt-3 grid gap-1 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">売上合計</span>
                <span className="font-semibold">{formatJPY(sumConnectorSales(db, me.id))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">報酬累計</span>
                <span className="font-semibold">{formatJPY(sumConnectorRewards(db, me.id))}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">クイックアクション</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/marketplace"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              >
                カタログ
              </Link>
              <Link
                to="/deals"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              >
                商談管理
              </Link>
              <Link
                to="/network"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              >
                組織/チーム
              </Link>
              <Link
                to="/rewards"
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
              >
                報酬/出金
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-sm font-semibold text-slate-900">ポイント</div>
            <div className="mt-2 text-sm text-slate-700">
              <ul className="list-disc pl-5">
                <li>コネクターはリンク発行→リード獲得（集客）</li>
                <li>代理店はコネクターの管理・教育・クロージング支援</li>
                <li>報酬は固定率で透明（15%/5%）</li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

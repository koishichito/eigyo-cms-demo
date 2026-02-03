import { useMemo } from 'react'
import { Card } from '../../components/Card'
import { Badge } from '../../components/Badge'
import { ToastProvider, useToast } from '../../components/Toast'
import { useDb } from '../../state/DbProvider'
import { agencies, connectorsForAgency, findUser, getCurrentUser, sumAgencyTeamSales, sumAgencyRewards } from '../../state/selectors'
import { buildAgencyInviteLink } from '../../utils/affiliate'
import { formatJPY } from '../../utils/format'

function AdminPartnersInner() {
  const { db, actions } = useDb()
  const me = getCurrentUser(db)
  const toast = useToast()

  if (me.role !== 'J-Navi管理者') {
    return (
      <Card title="組織/ユーザー（運営）" subtitle="このページはJnavi運営向けです">
        <div className="text-sm text-slate-600">権限がありません。</div>
      </Card>
    )
  }

  const agencyList = agencies(db)

  const connectors = useMemo(() => db.users.filter((u) => u.role === 'コネクター'), [db.users])

  return (
    <div className="space-y-6">
      <Card
        title="組織図（フラット）"
        subtitle="『代理店の箱の中にコネクターが横並び』。紹介関係（参考データ）はツリー化しません。"
      >
        <div className="space-y-4">
          {agencyList.map((ag) => {
            const team = connectorsForAgency(db, ag.id)
            const teamSales = sumAgencyTeamSales(db, ag.id)
            const agencyRewards = sumAgencyRewards(db, ag.id)
            const inviteUrl = ag.agency ? buildAgencyInviteLink(ag.agency.inviteCode) : ''

            return (
              <div key={ag.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-slate-900">{ag.name}</div>
                      <Badge tone="blue">代理店</Badge>
                    </div>
                    <div className="text-xs text-slate-500">{ag.email}</div>
                  </div>

                  <div className="text-right text-sm">
                    <div className="text-slate-700">チーム売上: {formatJPY(teamSales)}</div>
                    <div className="text-slate-700">代理店報酬(15%): {formatJPY(agencyRewards)}</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-slate-600">招待コード:</span>
                  <span className="rounded bg-slate-100 px-2 py-1 font-mono">{ag.agency?.inviteCode ?? '-'}</span>
                  {inviteUrl ? (
                    <a className="text-blue-600 hover:underline" href={inviteUrl} target="_blank" rel="noreferrer">
                      招待リンクを開く
                    </a>
                  ) : null}
                </div>

                <div className="mt-4 overflow-x-auto">
                  <div className="flex min-w-max gap-3">
                    {team.length === 0 ? (
                      <div className="text-sm text-slate-500">（コネクター未登録）</div>
                    ) : (
                      team.map((c) => {
                        const intro = c.connector?.introducedById ? findUser(db, c.connector.introducedById) : undefined
                        return (
                          <div key={c.id} className="w-56 rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-center justify-between">
                              <div className="font-semibold text-slate-900">{c.name}</div>
                              <Badge tone="green">コネクター</Badge>
                            </div>
                            <div className="text-xs text-slate-500">{c.email}</div>
                            {intro ? (
                              <div className="mt-2 text-xs text-slate-600">紹介者(参考): {intro.name}</div>
                            ) : (
                              <div className="mt-2 text-xs text-slate-400">紹介者(参考): -</div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="コネクター一覧" subtitle="所属代理店を変更できます（報酬計算の親子関係には使いません）">
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-3 py-2">コネクター</th>
                <th className="px-3 py-2">所属代理店</th>
                <th className="px-3 py-2">紹介者(参考)</th>
              </tr>
            </thead>
            <tbody>
              {connectors.map((c) => {
                const agencyId = c.connector?.agencyId
                const ag = agencyId ? findUser(db, agencyId) : undefined
                const intro = c.connector?.introducedById ? findUser(db, c.connector.introducedById) : undefined

                return (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm"
                        value={agencyId ?? ''}
                        onChange={(e) => {
                          const newAgencyId = e.target.value
                          const res = actions.adminSetConnectorAgency(c.id, newAgencyId)
                          if (!res.ok) toast.show(res.message ?? '更新できませんでした', 'error')
                          else toast.show('所属代理店を更新しました', 'success')
                        }}
                      >
                        <option value="" disabled>
                          選択してください
                        </option>
                        {agencyList.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <div className="mt-1 text-xs text-slate-500">現在: {ag?.name ?? '-'}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{intro?.name ?? '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {connectors.length === 0 ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            コネクターがいません。
          </div>
        ) : null}
      </Card>
    </div>
  )
}

export default function AdminPartnersPage() {
  return (
    <ToastProvider>
      <AdminPartnersInner />
    </ToastProvider>
  )
}

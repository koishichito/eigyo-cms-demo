import { useMemo } from 'react'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { useDb } from '../state/DbProvider'
import { agencies, connectorsForAgency, findUser, getCurrentUser, sumAgencyRewards, sumAgencyTeamSales, sumConnectorRewards, sumConnectorSales } from '../state/selectors'
import { buildAgencyInviteLink } from '../utils/affiliate'
import { formatJPY } from '../utils/format'

export default function NetworkPage() {
  const { db } = useDb()
  const me = getCurrentUser(db)

  const agency = useMemo(() => {
    if (me.role === '代理店') return me
    if (me.role === 'コネクター') {
      const agencyId = me.connector?.agencyId
      return db.users.find((u) => u.id === agencyId) ?? null
    }
    return null
  }, [db.users, me])

  const teamConnectors = useMemo(() => {
    if (!agency) return []
    return connectorsForAgency(db, agency.id)
  }, [db, agency])

  const inviter = me.role === 'コネクター' ? findUser(db, me.connector?.introducedById) : null

  return (
    <div className="grid gap-4">
      <Card title="組織/チーム" subtitle="3層フラット構造（Jnavi運営 → 代理店 → コネクター）">
        <div className="grid gap-2 text-sm text-slate-700">
          <div>
            あなたのロール: <span className="font-semibold">{me.role}</span>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            ※コネクター配下にコネクターは紐づきません。紹介関係は参考データとして保持しても、組織図・報酬計算には使いません。
          </div>
        </div>
      </Card>

      {me.role === 'コネクター' ? (
        <Card title="所属情報" subtitle="コネクターは必ず代理店に所属します">
          <div className="grid gap-2 text-sm">
            <div>
              所属代理店:{' '}
              <span className="font-semibold">{agency ? agency.name : '（未設定）'}</span>
            </div>
            {inviter ? (
              <div className="text-xs text-slate-600">
                紹介者（参考データ）: {inviter.name}
              </div>
            ) : (
              <div className="text-xs text-slate-600">紹介者（参考データ）: なし</div>
            )}
            <div className="mt-2 grid gap-1 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">あなたの売上合計</span>
                <span className="font-semibold">{formatJPY(sumConnectorSales(db, me.id))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">あなたの報酬合計（5%）</span>
                <span className="font-semibold">{formatJPY(sumConnectorRewards(db, me.id))}</span>
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      {agency ? (
        <AgencyBox agencyId={agency.id} title={me.role === '代理店' ? 'あなたの代理店チーム' : '所属代理店のチーム'} />
      ) : (
        <Card title="チーム" subtitle="代理店が見つかりません">
          <div className="text-sm text-slate-600">このコネクターは代理店に紐づいていません（デモデータの不整合）。</div>
        </Card>
      )}

      {me.role === '代理店' && agency ? (
        <Card title="コネクター招待" subtitle="招待リンクからコネクター登録（所属代理店は自動選択）">
          <div className="grid gap-2">
            <div className="text-sm text-slate-700">招待URL（共有用）</div>
            <input
              readOnly
              value={buildAgencyInviteLink(agency.agency?.inviteCode ?? '')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
            />
            <div className="text-xs text-slate-600">
              ※この招待コードは「紹介者」として参考データに保存されます（組織図/報酬の親子関係にはなりません）。
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function AgencyBox(props: { agencyId: string; title: string }) {
  const { db } = useDb()
  const agency = db.users.find((u) => u.id === props.agencyId)
  const connectors = useMemo(() => connectorsForAgency(db, props.agencyId), [db, props.agencyId])

  if (!agency) {
    return (
      <Card title={props.title} subtitle="代理店が見つかりません">
        <div className="text-sm text-slate-600">（デモデータ不整合）</div>
      </Card>
    )
  }

  return (
    <Card title={props.title} subtitle="代理店の箱の中にコネクターがフラットに並ぶ表示">
      <div className="grid gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">{agency.name}</div>
              <div className="text-xs text-slate-500">代理店（Team Leader）</div>
            </div>
            <Badge tone="slate">コネクター数: {connectors.length}</Badge>
          </div>

          <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">チーム売上合計</span>
              <span className="font-semibold">{formatJPY(sumAgencyTeamSales(db, agency.id))}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">代理店報酬合計（15%）</span>
              <span className="font-semibold">{formatJPY(sumAgencyRewards(db, agency.id))}</span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <div className="flex min-w-max items-stretch gap-2">
              {connectors.length === 0 ? (
                <div className="text-sm text-slate-600">（配下コネクターなし）</div>
              ) : null}
              {connectors.map((c) => {
                const intro = findUser(db, c.connector?.introducedById)
                return (
                  <div key={c.id} className="w-56 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="text-sm font-semibold text-slate-900">{c.name}</div>
                    <div className="mt-1 text-xs text-slate-500">コネクター</div>
                    <div className="mt-2 grid gap-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">売上</span>
                        <span className="font-medium">{formatJPY(sumConnectorSales(db, c.id))}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">報酬（5%）</span>
                        <span className="font-medium">{formatJPY(sumConnectorRewards(db, c.id))}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        紹介者（参考）: {intro ? intro.name : 'なし'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

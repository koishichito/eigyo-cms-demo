import { useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { ToastProvider, useToast } from '../../components/Toast'
import { useDb } from '../../state/DbProvider'
import { getCurrentUser } from '../../state/selectors'

function AdminCommissionInner() {
  const { db, actions } = useDb()
  const toast = useToast()
  if (!db) return null
  const me = getCurrentUser(db)

  if (me.role !== 'J-Navi管理者') {
    return (
      <Card title="報酬設定（運営）" subtitle="このページはJnavi運営向けです">
        <div className="text-sm text-slate-600">権限がありません。</div>
      </Card>
    )
  }

  const [agencyRatePct, setAgencyRatePct] = useState(String(Math.round(db.settings.agencyRate * 10000) / 100))
  const [connectorRatePct, setConnectorRatePct] = useState(
    String(Math.round(db.settings.connectorRate * 10000) / 100)
  )

  return (
    <Card
      title="報酬設定（Model A）"
      subtitle="代理店15%／コネクター5%（固定）を一律適用します。案件単位でブラックボックスにしません。"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">現在の設定</div>
          <div className="mt-2 text-sm text-slate-700">
            代理店報酬: {Math.round(db.settings.agencyRate * 10000) / 100}%
          </div>
          <div className="text-sm text-slate-700">
            コネクター報酬: {Math.round(db.settings.connectorRate * 10000) / 100}%
          </div>
          <div className="mt-2 text-xs text-slate-500">
            ※このデモでは「報酬計算対象額 = 売上」として計算しています。
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-sm font-semibold text-slate-900">変更（運営のみ）</div>
          <div className="mt-3 space-y-3">
            <label className="block">
              <div className="text-xs text-slate-600">代理店報酬（%）</div>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={agencyRatePct}
                onChange={(e) => setAgencyRatePct(e.target.value)}
              />
            </label>
            <label className="block">
              <div className="text-xs text-slate-600">コネクター報酬（%）</div>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={connectorRatePct}
                onChange={(e) => setConnectorRatePct(e.target.value)}
              />
            </label>

            <Button
              variant="primary"
              onClick={async () => {
                const ar = Number(agencyRatePct) / 100
                const cr = Number(connectorRatePct) / 100

                const res = await actions.adminSetCommissionRates(ar, cr)
                if (!res.ok) toast.show(res.message ?? '更新できませんでした', 'error')
                else toast.show('報酬率を更新しました', 'success')
              }}
            >
              保存
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div className="font-semibold">UI要件（透明性）</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
          <li>報酬明細では「代理店15%」「コネクター5%」を明記して表示します。</li>
          <li>組織（紹介関係）はフラットで、報酬計算に親子関係は使いません。</li>
        </ul>
      </div>
    </Card>
  )
}

export default function AdminRanksPage() {
  return (
    <ToastProvider>
      <AdminCommissionInner />
    </ToastProvider>
  )
}

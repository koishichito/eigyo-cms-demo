import { useMemo } from 'react'
import { Card } from '../components/Card'
import { Badge } from '../components/Badge'
import { Button } from '../components/Button'
import { ToastProvider, useToast } from '../components/Toast'
import { useDb } from '../state/DbProvider'
import { getCurrentUser } from '../state/selectors'
import { formatDateYMD, formatJPY } from '../utils/format'
import type { UserRewardAllocation } from '../state/types'

function RewardsInner() {
  const { db, actions } = useDb()
  const toast = useToast()
  if (!db) return null
  const me = getCurrentUser(db)

  const rows = useMemo(() => {
    const out: Array<{
      txId: string
      createdAt: string
      productName: string
      dealId: string
      baseAmountJPY: number
      rate: number
      amountJPY: number
      status: UserRewardAllocation['status']
      label: string
      payoutRequestId?: string
    }> = []

    db.transactions.forEach((t) => {
      t.allocations.forEach((a) => {
        if (a.recipientType !== 'ユーザー報酬') return
        if (a.userId !== me.id) return
        out.push({
          txId: t.id,
          createdAt: t.createdAt,
          productName: t.productSnapshot.name,
          dealId: t.dealId,
          baseAmountJPY: a.baseAmountJPY,
          rate: a.rate,
          amountJPY: a.amountJPY,
          status: a.status,
          label: a.label,
          payoutRequestId: a.payoutRequestId,
        })
      })
    })

    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [db.transactions, me.id])

  const sums = useMemo(() => {
    const s = { 未確定: 0, 確定: 0, 申請中: 0, 支払済み: 0 }
    rows.forEach((r) => {
      if (r.status === '未確定') s.未確定 += r.amountJPY
      if (r.status === '確定' && !r.payoutRequestId) s.確定 += r.amountJPY
      if (r.status === '確定' && r.payoutRequestId) s.申請中 += r.amountJPY
      if (r.status === '支払済み') s.支払済み += r.amountJPY
    })
    return s
  }, [rows])

  return (
    <div className="grid gap-4">
      <Card title="報酬/出金" subtitle="報酬総額15%（代理店10%・コネクター5%）の内訳が明記されます">
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryBox label="未確定" value={sums.未確定} tone="amber" />
          <SummaryBox label="確定" value={sums.確定} tone="emerald" />
          <SummaryBox label="申請中" value={sums.申請中} tone="blue" />
          <SummaryBox label="支払済み" value={sums.支払済み} tone="slate" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            出金可能（確定）: <span className="font-semibold">{formatJPY(sums.確定)}</span> / 最低出金額:{' '}
            <span className="font-semibold">{formatJPY(db.settings.minPayoutJPY)}</span>
          </div>

          <Button
            variant="primary"
            disabled={sums.確定 < db.settings.minPayoutJPY}
            onClick={async () => {
              const res = await actions.requestPayoutAll()
              if (!res.ok) {
                toast.show(res.message ?? '申請できませんでした', 'error')
                return
              }
              toast.show('出金申請を作成しました', 'success')
            }}
          >
            出金申請
          </Button>
        </div>
      </Card>

      <Card title="報酬明細" subtitle="base × rate の計算式がブラックボックスにならないよう明示">
        {rows.length === 0 ? <div className="text-sm text-slate-600">報酬明細がありません。</div> : null}

        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.txId + r.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{r.productName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatDateYMD(r.createdAt)} / 案件ID: {r.dealId}
                  </div>
                </div>
                <Badge
                  tone={
                    r.status === '確定'
                      ? r.payoutRequestId
                        ? 'blue'
                        : 'emerald'
                      : r.status === '未確定'
                        ? 'amber'
                        : 'slate'
                  }
                >
                  {r.status === '確定' && r.payoutRequestId ? '申請中' : r.status}
                </Badge>
              </div>

              <div className="mt-3 grid gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">内訳</span>
                  <span className="font-medium">{r.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">報酬計算対象額（base）</span>
                  <span className="font-medium">{formatJPY(r.baseAmountJPY)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">率（rate）</span>
                  <span className="font-medium">{Math.round(r.rate * 1000) / 10}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">あなたの報酬</span>
                  <span className="text-base font-semibold">{formatJPY(r.amountJPY)}</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-500">
                計算式: {formatJPY(r.baseAmountJPY)} × {Math.round(r.rate * 1000) / 10}% = {formatJPY(r.amountJPY)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function SummaryBox(props: { label: string; value: number; tone: 'amber' | 'emerald' | 'slate' | 'blue' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">{props.label}</div>
      <div className="mt-1 flex items-center gap-2">
        <div className="text-xl font-semibold text-slate-900">{formatJPY(props.value)}</div>
        <Badge tone={props.tone}>{props.label}</Badge>
      </div>
    </div>
  )
}

export default function RewardsPage() {
  return (
    <ToastProvider>
      <RewardsInner />
    </ToastProvider>
  )
}

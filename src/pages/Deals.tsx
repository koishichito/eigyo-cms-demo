import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { ToastProvider, useToast } from '../components/Toast'
import { useDb } from '../state/DbProvider'
import { agencies, findProduct, findUser, getCurrentUser, connectorsForAgency } from '../state/selectors'
import type { Deal, DealStatus, Product } from '../state/types'
import { formatDateYMD, formatJPY } from '../utils/format'
import { calculateModelAAmounts } from '../utils/reward'

function statusFlow(productType: Product['type']): DealStatus[] {
  if (productType === 'hotel_membership') {
    return ['申し込み', '失注']
  }
  if (productType === 'ad_slot') {
    return ['申し込み', '審査', '失注']
  }
  return ['リード発生', '商談中', '契約締結', '失注']
}

function revenueLabel(productType: Product['type']): string {
  if (productType === 'hotel_membership') return '決済完了（売上確定）'
  if (productType === 'ad_slot') return '掲載開始（売上確定）'
  return '施工完了（売上確定）'
}

function DealsInner() {
  const { db, actions } = useDb()
  const me = getCurrentUser(db)
  const toast = useToast()

  const myDeals = useMemo(() => {
    if (me.role === 'コネクター') {
      return db.deals.filter((d) => d.connectorId === me.id)
    }
    if (me.role === '代理店') {
      const team = connectorsForAgency(db, me.id).map((c) => c.id)
      return db.deals.filter((d) => team.includes(d.connectorId))
    }
    return []
  }, [db, me])

  const openDeals = useMemo(() => myDeals.filter((d) => !d.locked), [myDeals])
  const closedDeals = useMemo(() => myDeals.filter((d) => d.locked), [myDeals])

  const [showCreate, setShowCreate] = useState(false)
  const [createProductId, setCreateProductId] = useState('')
  const [createCompany, setCreateCompany] = useState('')
  const [createName, setCreateName] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createMemo, setCreateMemo] = useState('')

  const canCreate = me.role === 'コネクター'

  const [finalizeDealId, setFinalizeDealId] = useState<string | null>(null)

  const finalizeTarget = useMemo(() => myDeals.find((d) => d.id === finalizeDealId) ?? null, [myDeals, finalizeDealId])
  const finalizeProduct = useMemo(() => (finalizeTarget ? findProduct(db, finalizeTarget.productId) : undefined), [db, finalizeTarget])

  return (
    <div className="grid gap-4">
      <Card
        title="商談管理"
        subtitle={
          me.role === '代理店'
            ? '配下コネクターの商談状況を閲覧・更新できます（フラット構造）'
            : '自分の商談状況を管理できます'
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            未確定: <span className="font-semibold">{openDeals.length}</span> / 売上確定: <span className="font-semibold">{closedDeals.length}</span>
          </div>

          {canCreate ? (
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              手動で商談を登録
            </Button>
          ) : (
            <div className="text-xs text-slate-500">※手動登録はコネクターのみ</div>
          )}
        </div>
      </Card>

      <Card title="進行中" subtitle="ステータス更新 → 最終ステージで売上確定（報酬計算）">
        {openDeals.length === 0 ? <div className="text-sm text-slate-600">進行中の商談はありません。</div> : null}

        <div className="grid gap-3">
          {openDeals
            .slice()
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .map((d) => (
              <DealRow
                key={d.id}
                deal={d}
                showConnector={me.role === '代理店'}
                onUpdateStatus={(next) => {
                  const res = actions.updateDealStatus(d.id, next)
                  if (!res.ok) toast.show(res.message ?? '更新できませんでした', 'error')
                }}
                onFinalize={() => setFinalizeDealId(d.id)}
              />
            ))}
        </div>
      </Card>

      <Card title="売上確定済み" subtitle="売上確定時点で取引（配分）が作られます">
        {closedDeals.length === 0 ? <div className="text-sm text-slate-600">売上確定済みの商談はありません。</div> : null}

        <div className="grid gap-3">
          {closedDeals
            .slice()
            .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
            .map((d) => (
              <DealRow key={d.id} deal={d} showConnector={me.role === '代理店'} />
            ))}
        </div>
      </Card>

      {/* Create */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="手動で商談を登録">
        <div className="grid gap-3 text-sm">
          <label className="grid gap-1">
            <span className="text-slate-700">商材</span>
            <select
              value={createProductId}
              onChange={(e) => setCreateProductId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <option value="">選択してください</option>
              {db.products
                .filter((p) => p.isPublic)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-slate-700">会社名</span>
            <input
              value={createCompany}
              onChange={(e) => setCreateCompany(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-slate-700">担当者名</span>
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
          <label className="grid gap-1">
            <span className="text-slate-700">メール</span>
            <input
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2"
              type="email"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-slate-700">電話（任意）</span>
            <input value={createPhone} onChange={(e) => setCreatePhone(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
          </label>
          <label className="grid gap-1">
            <span className="text-slate-700">備考（任意）</span>
            <textarea
              value={createMemo}
              onChange={(e) => setCreateMemo(e.target.value)}
              className="min-h-24 rounded-lg border border-slate-200 bg-white px-3 py-2"
            />
          </label>

          <Button
            variant="primary"
            disabled={!createProductId || !createCompany || !createName || !createEmail}
            onClick={() => {
              const res = actions.createDealManual({
                productId: createProductId,
                customerCompanyName: createCompany,
                customerName: createName,
                customerEmail: createEmail,
                customerPhone: createPhone,
                memo: createMemo,
              })
              if (!res.ok) {
                toast.show(res.message ?? '登録できませんでした', 'error')
                return
              }
              toast.show('登録しました', 'success')
              setShowCreate(false)
              setCreateProductId('')
              setCreateCompany('')
              setCreateName('')
              setCreateEmail('')
              setCreatePhone('')
              setCreateMemo('')
            }}
          >
            登録する
          </Button>
        </div>
      </Modal>

      {/* Finalize */}
      <Modal
        open={!!finalizeTarget && !!finalizeProduct}
        onClose={() => setFinalizeDealId(null)}
        title={finalizeProduct ? revenueLabel(finalizeProduct.type) : '売上確定'}
      >
        {finalizeTarget && finalizeProduct ? (
          <FinalizeForm
            deal={finalizeTarget}
            product={finalizeProduct}
            onClose={() => setFinalizeDealId(null)}
          />
        ) : null}
      </Modal>
    </div>
  )
}

function DealRow(props: {
  deal: Deal
  showConnector: boolean
  onUpdateStatus?: (next: DealStatus) => void
  onFinalize?: () => void
}) {
  const { db } = useDb()
  const product = findProduct(db, props.deal.productId)
  const connector = findUser(db, props.deal.connectorId)

  const options = useMemo(() => {
    if (!product) return []
    return statusFlow(product.type).filter((s) => s !== props.deal.status)
  }, [product, props.deal.status])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {product ? product.name : '（商品不明）'}
            <span className="ml-2 text-xs text-slate-500">{props.deal.customerCompanyName}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {formatDateYMD(props.deal.createdAt)} / ステータス: <span className="font-medium">{props.deal.status}</span>
            {props.deal.locked && props.deal.closingDate ? (
              <span className="ml-2">（確定日: {props.deal.closingDate}）</span>
            ) : null}
          </div>
          {props.showConnector && connector ? (
            <div className="mt-1 text-xs text-slate-600">担当コネクター: {connector.name}</div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {props.deal.locked ? <Badge tone="emerald">売上確定</Badge> : <Badge tone="amber">進行中</Badge>}

          {!props.deal.locked && props.onUpdateStatus ? (
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              value=""
              onChange={(e) => {
                const v = e.target.value as DealStatus
                if (!v) return
                props.onUpdateStatus?.(v)
                e.currentTarget.value = ''
              }}
            >
              <option value="">ステータス更新</option>
              {options.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : null}

          {!props.deal.locked && props.onFinalize ? (
            <Button variant="primary" onClick={props.onFinalize}>
              売上確定
            </Button>
          ) : null}
        </div>
      </div>

      {props.deal.finalSaleAmountJPY ? (
        <div className="mt-3 text-sm">
          <span className="text-slate-500">確定金額:</span>{' '}
          <span className="font-semibold">{formatJPY(props.deal.finalSaleAmountJPY)}</span>
        </div>
      ) : null}

      {props.deal.memo ? <div className="mt-3 text-sm text-slate-700">備考: {props.deal.memo}</div> : null}
    </div>
  )
}

function FinalizeForm(props: { deal: Deal; product: Product; onClose: () => void }) {
  const { db, actions } = useDb()
  const toast = useToast()

  const [sale, setSale] = useState<number>(props.product.listPriceJPY)
  const [date, setDate] = useState<string>(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })

  const amounts = useMemo(() => {
    return calculateModelAAmounts({
      baseAmountJPY: sale || 0,
      agencyRate: db.settings.agencyRate,
      connectorRate: db.settings.connectorRate,
    })
  }, [sale, db.settings.agencyRate, db.settings.connectorRate])

  return (
    <div className="grid gap-4">
      <div className="text-sm text-slate-700">
        <div className="font-semibold">{props.product.name}</div>
        <div className="text-xs text-slate-500">商談ID: {props.deal.id}</div>
      </div>

      <div className="grid gap-3 text-sm">
        <label className="grid gap-1">
          <span className="text-slate-700">確定金額（売上）</span>
          <input
            value={String(sale)}
            onChange={(e) => setSale(Number(e.target.value) || 0)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2"
            inputMode="numeric"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-slate-700">確定日（YYYY-MM-DD）</span>
          <input
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2"
            placeholder="2026-02-02"
          />
        </label>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-sm font-semibold text-slate-900">配分（固定率）</div>
          <div className="mt-2 grid gap-1 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">報酬計算対象額</span>
              <span className="font-semibold">{formatJPY(amounts.baseAmountJPY)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">代理店報酬（{Math.round((db.settings.agencyRate - db.settings.connectorRate) * 1000) / 10}%）</span>
              <span className="font-semibold">{formatJPY(amounts.agencyRewardJPY)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">コネクター報酬（{Math.round(db.settings.connectorRate * 1000) / 10}%）</span>
              <span className="font-semibold">{formatJPY(amounts.connectorRewardJPY)}</span>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Jnavi取り分（残余）: {formatJPY(amounts.jnaviShareJPY)}
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => {
            const res = actions.finalizeDeal({ dealId: props.deal.id, finalSaleAmountJPY: sale, closingDate: date })
            if (!res.ok) {
              toast.show(res.message ?? '確定できませんでした', 'error')
              return
            }
            toast.show('売上を確定しました（取引/報酬を作成）', 'success')
            props.onClose()
          }}
        >
          売上確定する
        </Button>
      </div>
    </div>
  )
}

export default function DealsPage() {
  return (
    <ToastProvider>
      <DealsInner />
    </ToastProvider>
  )
}

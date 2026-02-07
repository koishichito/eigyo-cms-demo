import { useMemo, useState } from 'react'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Badge } from '../components/Badge'
import { Modal } from '../components/Modal'
import { useDb } from '../state/DbProvider'
import { getCurrentUser } from '../state/selectors'
import { formatJPY } from '../utils/format'
import { buildProductReferralLink } from '../utils/affiliate'
import { calculateModelAAmounts } from '../utils/reward'

function prettyProductType(productType: string) {
  if (productType === 'hotel_membership') return '即決型（物販）'
  if (productType === 'ad_slot') return '継続型（広告）'
  return '高単価（フロー型）'
}

export default function MarketplacePage() {
  const { db } = useDb()
  if (!db) return null
  const me = getCurrentUser(db)

  const products = useMemo(() => db.products.filter((p) => p.isPublic), [db.products])

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category)))
    return ['すべて', ...cats]
  }, [products])

  const [cat, setCat] = useState('すべて')
  const filtered = useMemo(() => {
    if (cat === 'すべて') return products
    return products.filter((p) => p.category === cat)
  }, [products, cat])

  const [openId, setOpenId] = useState<string | null>(null)
  const openProduct = useMemo(() => filtered.find((p) => p.id === openId) ?? null, [filtered, openId])

  const canIssueLink = me.role === 'コネクター'

  return (
    <div className="grid gap-4">
      <Card
        title="カタログ（取り扱い可能案件）"
        subtitle="全コネクターに 3 商材が公開されています（アクセス制限なし）"
      >
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={
                c === cat
                  ? 'rounded-full bg-[var(--jnavi-navy)] px-3 py-1 text-sm text-white'
                  : 'rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 hover:bg-slate-50'
              }
            >
              {c}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-900">{p.name}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {p.category} / {prettyProductType(p.type)}
                </div>
              </div>
              <Badge tone="slate">公開</Badge>
            </div>

            <div className="mt-3 text-sm text-slate-700 line-clamp-3">{p.description}</div>

            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">参考価格</span>
              <span className="font-medium">{formatJPY(p.listPriceJPY)}</span>
            </div>

            {p.category === '広告枠' && p.vacancyStatus ? (
              <div className="mt-2 text-xs text-slate-600">空き状況: {p.vacancyStatus}</div>
            ) : null}

            <div className="mt-4">
              <Button variant="primary" onClick={() => setOpenId(p.id)}>
                詳細 / リンク発行
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={!!openProduct} onClose={() => setOpenId(null)} title={openProduct?.name ?? '詳細'}>
        {openProduct ? (
          <div className="grid gap-4">
            <div className="grid gap-1 text-sm">
              <div className="text-slate-700">{openProduct.description}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="slate">{openProduct.category}</Badge>
                <Badge tone="blue">{prettyProductType(openProduct.type)}</Badge>
              </div>
              <div className="mt-2 text-sm text-slate-600">参考価格: {formatJPY(openProduct.listPriceJPY)}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm font-semibold text-slate-900">リンク発行</div>
              {!canIssueLink ? (
                <div className="mt-2 text-sm text-slate-700">
                  この操作は <span className="font-semibold">コネクター</span> のみ実行できます。
                </div>
              ) : (
                <div className="mt-2 grid gap-2">
                  <div className="text-xs text-slate-600">固有リンク（LP/申込ページ）</div>
                  <input
                    readOnly
                    value={buildProductReferralLink(me.id, openProduct.id)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                  />
                  <div className="text-xs text-slate-500">
                    ※このリンク経由のリード/申込は「あなた（コネクター）」に紐づき、報酬は 5% で自動計算されます。
                  </div>
                </div>
              )}
            </div>

            <CommissionPreview baseDefault={openProduct.listPriceJPY} role={me.role} />

            {openProduct.materials?.length ? (
              <div>
                <div className="text-sm font-semibold text-slate-900">資料</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {openProduct.materials.map((m) => (
                    <a
                      key={m.href}
                      href={m.href}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-slate-50"
                    >
                      {m.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

function CommissionPreview(props: { baseDefault: number; role: string }) {
  const { db } = useDb()
  const [base, setBase] = useState<number>(props.baseDefault)
  if (!db) return null

  const amounts = useMemo(() => {
    return calculateModelAAmounts({
      baseAmountJPY: base || 0,
      agencyRate: db.settings.agencyRate,
      connectorRate: db.settings.connectorRate,
    })
  }, [base, db.settings.agencyRate, db.settings.connectorRate])

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-sm font-semibold text-slate-900">報酬シミュレーション（固定率）</div>
      <div className="mt-2 grid gap-2 text-sm">
        <label className="grid gap-1">
          <span className="text-slate-600">報酬計算対象額（今回は売上ベース想定）</span>
          <input
            value={String(base)}
            onChange={(e) => setBase(Number(e.target.value) || 0)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
            inputMode="numeric"
          />
        </label>

        <div className="grid gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
          {props.role === '代理店' ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">あなたの代理店報酬（{Math.round((db.settings.agencyRate - db.settings.connectorRate) * 1000) / 10}%）</span>
              <span className="font-semibold">{formatJPY(amounts.agencyRewardJPY)}</span>
            </div>
          ) : props.role === 'コネクター' ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">あなたのコネクター報酬（5%）</span>
              <span className="font-semibold">{formatJPY(amounts.connectorRewardJPY)}</span>
            </div>
          ) : null}

          <div className="mt-2 text-xs text-slate-500">
            ※運営側では「代理店: base×{Math.round((db.settings.agencyRate - db.settings.connectorRate) * 1000) / 10}%」「コネクター: base×{Math.round(db.settings.connectorRate * 1000) / 10}%」の内訳を監査ログに残します。
          </div>
        </div>
      </div>
    </div>
  )
}

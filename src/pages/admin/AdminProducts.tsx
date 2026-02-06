import { useMemo, useState } from 'react'
import { Card } from '../../components/Card'
import { Button } from '../../components/Button'
import { Badge } from '../../components/Badge'
import { Modal } from '../../components/Modal'
import { ToastProvider, useToast } from '../../components/Toast'
import { useDb } from '../../state/DbProvider'
import { getCurrentUser } from '../../state/selectors'
import { formatJPY } from '../../utils/format'
import type { Product, ProductCategory, ProductType, VacancyStatus } from '../../state/types'

const CATEGORY: ProductCategory[] = ['サイネージ', 'ホテル', '広告枠']
const TYPES: { label: string; value: ProductType }[] = [
  { label: '窓ガラスサイネージ', value: 'signage' },
  { label: 'JNホテル会員権', value: 'hotel_membership' },
  { label: '広告枠', value: 'ad_slot' },
]
const VACANCY: VacancyStatus[] = ['募集中', '残りわずか', '売切']

function emptyDraft(defaultSupplierId: string): Product {
  return {
    id: 'new',
    supplierId: defaultSupplierId,
    name: '',
    category: 'サイネージ',
    type: 'signage',
    listPriceJPY: 0,
    description: '',
    isPublic: true,
    materials: [],
  }
}

function AdminProductsInner() {
  const { db, actions } = useDb()
  const toast = useToast()
  if (!db) return null
  const me = getCurrentUser(db)

  if (me.role !== 'J-Navi管理者') {
    return (
      <Card title="商品マスタ（運営）" subtitle="このページはJnavi運営向けです">
        <div className="text-sm text-slate-600">権限がありません。</div>
      </Card>
    )
  }

  const defaultSupplierId = db.suppliers[0]?.id ?? 'sup_001'

  const suppliersById = useMemo(() => Object.fromEntries(db.suppliers.map((s) => [s.id, s])), [db.suppliers])

  const [editing, setEditing] = useState<Product | null>(null)
  const [isCreate, setIsCreate] = useState(false)

  const openCreate = () => {
    setIsCreate(true)
    setEditing(emptyDraft(defaultSupplierId))
  }

  const openEdit = (p: Product) => {
    setIsCreate(false)
    setEditing(JSON.parse(JSON.stringify(p)))
  }

  return (
    <Card title="商品マスタ" subtitle="3商材（サイネージ/ホテル/広告）をカタログに並べます">
      <div className="flex justify-end">
        <Button variant="primary" onClick={openCreate}>
          新規作成
        </Button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">商品</th>
              <th className="px-3 py-2">種別</th>
              <th className="px-3 py-2">カテゴリ</th>
              <th className="px-3 py-2">価格</th>
              <th className="px-3 py-2">公開</th>
              <th className="px-3 py-2">サプライヤー</th>
              <th className="px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {db.products.map((p) => {
              const supplier = suppliersById[p.supplierId]
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500 font-mono">{p.id}</div>
                    {p.type === 'ad_slot' ? (
                      <div className="mt-1 text-xs text-slate-600">空き枠: {p.vacancyStatus ?? '-'}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{TYPES.find((t) => t.value === p.type)?.label ?? p.type}</td>
                  <td className="px-3 py-2">{p.category}</td>
                  <td className="px-3 py-2">{formatJPY(p.listPriceJPY)}</td>
                  <td className="px-3 py-2">{p.isPublic ? <Badge tone="green">公開</Badge> : <Badge tone="slate">非公開</Badge>}</td>
                  <td className="px-3 py-2 text-sm text-slate-700">{supplier?.name ?? p.supplierId}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(p)}>
                      編集
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={isCreate ? '商品 新規作成' : '商品 編集'}>
        {editing ? (
          <div className="space-y-3">
            <label className="block">
              <div className="text-xs text-slate-600">商品名</div>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <div className="text-xs text-slate-600">種別</div>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={editing.type}
                  onChange={(e) => setEditing({ ...editing, type: e.target.value as ProductType })}
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="text-xs text-slate-600">カテゴリ</div>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as ProductCategory })}
                >
                  {CATEGORY.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <div className="text-xs text-slate-600">価格（JPY）</div>
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                value={editing.listPriceJPY}
                onChange={(e) => setEditing({ ...editing, listPriceJPY: Number(e.target.value) })}
              />
              <div className="mt-1 text-xs text-slate-500">※広告枠は「月額（初月分）」として扱います。</div>
            </label>

            {editing.type === 'ad_slot' ? (
              <label className="block">
                <div className="text-xs text-slate-600">空き枠状況</div>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={editing.vacancyStatus ?? '募集中'}
                  onChange={(e) => setEditing({ ...editing, vacancyStatus: e.target.value as VacancyStatus })}
                >
                  {VACANCY.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block">
              <div className="text-xs text-slate-600">説明</div>
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                rows={4}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editing.isPublic}
                onChange={(e) => setEditing({ ...editing, isPublic: e.target.checked })}
              />
              コネクターに公開する
            </label>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                キャンセル
              </Button>
              <Button
                variant="primary"
                onClick={async () => {
                  if (!editing.name.trim()) {
                    toast.show('商品名を入力してください', 'error')
                    return
                  }

                  if (isCreate) {
                    const res = await actions.createProduct({
                      supplierId: editing.supplierId,
                      name: editing.name,
                      category: editing.category,
                      type: editing.type,
                      listPriceJPY: editing.listPriceJPY,
                      description: editing.description,
                      isPublic: editing.isPublic,
                      materials: [],
                      vacancyStatus: editing.vacancyStatus,
                      adSpec: editing.adSpec,
                    })

                    if (!res.ok) toast.show(res.message ?? '作成できませんでした', 'error')
                    else {
                      toast.show('作成しました', 'success')
                      setEditing(null)
                    }
                    return
                  }

                  const res = await actions.updateProduct({ ...editing })
                  if (!res.ok) toast.show(res.message ?? '更新できませんでした', 'error')
                  else {
                    toast.show('更新しました', 'success')
                    setEditing(null)
                  }
                }}
              >
                保存
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </Card>
  )
}

export default function AdminProductsPage() {
  return (
    <ToastProvider>
      <AdminProductsInner />
    </ToastProvider>
  )
}

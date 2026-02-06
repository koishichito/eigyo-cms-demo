import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ToastProvider, useToast } from '../components/Toast'
import { useDb } from '../state/DbProvider'
import { findProduct, findUser } from '../state/selectors'
import { formatJPY } from '../utils/format'

function actionLabel(productType?: string): { title: string; button: string } {
  if (productType === 'hotel_membership') {
    return { title: '購入申し込み', button: '申し込む（デモ）' }
  }
  if (productType === 'ad_slot') {
    return { title: '広告出稿申し込み', button: '申し込みを送信する' }
  }
  return { title: '問い合わせ', button: '問い合わせを送信する' }
}

function LpInner() {
  const { db, actions } = useDb()
  const toast = useToast()
  const location = useLocation()

  const { connectorId, productId } = useMemo(() => {
    const sp = new URLSearchParams(location.search)
    return {
      connectorId: sp.get('connectorId') ?? '',
      productId: sp.get('productId') ?? '',
    }
  }, [location.search])

  const connector = db ? findUser(db, connectorId) : undefined
  const product = db ? findProduct(db, productId) : undefined

  const [company, setCompany] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [memo, setMemo] = useState('')

  const okConnector = !!connector && connector.role === 'コネクター'
  const canSubmit = okConnector && !!product && product.isPublic && company && name && email

  const labels = actionLabel(product?.type)

  return (
    <div className="mx-auto max-w-3xl">
      <Card
        title={product ? product.name : '申込ページ'}
        subtitle={
          okConnector
            ? `担当コネクター: ${connector!.name}`
            : '担当コネクターが特定できません（URLの connectorId を確認してください）'
        }
      >
        {!product ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            商品が見つかりません。URLの <span className="font-mono">productId</span> を確認してください。
          </div>
        ) : !product.isPublic ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            この商品は現在「非公開」です（受付停止中）。
          </div>
        ) : product.category === '広告枠' && product.vacancyStatus === '売切' ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            この広告枠は売切です。
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">概要</div>
              <div className="mt-2 text-sm text-slate-700">{product.description}</div>

              <div className="mt-3 grid gap-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">カテゴリ</span>
                  <span className="font-medium">{product.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">参考価格</span>
                  <span className="font-medium">{formatJPY(product.listPriceJPY)}</span>
                </div>
              </div>

              {product.category === '広告枠' && product.adSpec ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <div className="font-semibold text-slate-800">広告枠スペック</div>
                  <div className="mt-2 grid gap-1 text-slate-700">
                    <div>
                      <span className="text-slate-500">場所:</span> {product.adSpec.address}
                    </div>
                    {product.adSpec.mapUrl ? (
                      <div>
                        <a
                          href={product.adSpec.mapUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          地図を開く
                        </a>
                      </div>
                    ) : null}
                    <div>
                      <span className="text-slate-500">サイズ:</span> {product.adSpec.size}
                    </div>
                    <div>
                      <span className="text-slate-500">再生頻度:</span> {product.adSpec.playbackFrequency}
                    </div>
                    {product.vacancyStatus ? (
                      <div>
                        <span className="text-slate-500">空き状況:</span> {product.vacancyStatus}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {product.materials?.length ? (
                <div className="mt-4">
                  <div className="text-sm font-semibold text-slate-900">資料</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {product.materials.map((m) => (
                      <a
                        key={m.href}
                        href={m.href}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm text-blue-600 hover:bg-slate-50"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {m.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">{labels.title}</div>
              <div className="mt-3 grid gap-2 text-sm">
                <label className="grid gap-1">
                  <span className="text-slate-700">会社名</span>
                  <input
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-slate-700">担当者名</span>
                  <input
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-slate-700">メール</span>
                  <input
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-slate-700">電話（任意）</span>
                  <input
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-slate-700">備考（任意）</span>
                  <textarea
                    className="min-h-24 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </label>

                <Button
                  variant="primary"
                  disabled={!canSubmit}
                  onClick={async () => {
                    if (!connector || connector.role !== 'コネクター' || !product) return
                    const res = await actions.createDealFromReferral({
                      connectorId: connector.id,
                      productId: product.id,
                      customerCompanyName: company,
                      customerName: name,
                      customerEmail: email,
                      customerPhone: phone,
                      memo,
                    })
                    if (!res.ok) {
                      toast.show(res.message ?? '送信できませんでした', 'error')
                      return
                    }
                    toast.show('送信しました。担当者からご連絡します。', 'success')
                    setCompany('')
                    setName('')
                    setEmail('')
                    setPhone('')
                    setMemo('')
                  }}
                >
                  {labels.button}
                </Button>

                <div className="text-xs text-slate-500">
                  ※送信すると「商談」が自動登録され、コネクター（および所属代理店）に紐づきます。
                </div>

                <div className="pt-2 text-xs text-slate-600">
                  <Link to="/login" className="text-blue-600 hover:underline">
                    ログイン
                  </Link>
                  して商談状況を確認できます（代理店/コネクター/運営向け）。
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

export default function ReferralLandingPage() {
  return (
    <ToastProvider>
      <LpInner />
    </ToastProvider>
  )
}

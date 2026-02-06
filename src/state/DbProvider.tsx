import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import bcrypt from 'bcryptjs'
import { seedDb } from '../data/seed'
import type {
  BankAccount,
  Db,
  Deal,
  DealStatus,
  PayoutRequest,
  Product,
  RewardStatus,
  Transaction,
  User,
  UserRole,
} from './types'
import { calculateModelAAmounts, initialRewardStatusForProductType } from '../utils/reward'

const STORAGE_KEY = 'jnavi_matching_demo_db_v4'

function uid(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 10)
  return `${prefix}_${Date.now().toString(16)}_${rand}`
}

function nowIso() {
  return new Date().toISOString()
}

function safeEmail(email: string) {
  return email.trim().toLowerCase()
}

function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase()
}

function findUserByEmail(db: Db, email: string): User | undefined {
  const e = safeEmail(email)
  return db.users.find((u) => safeEmail(u.email) === e)
}

function requireSession(db: Db): User {
  const u = db.users.find((x) => x.id === db.sessionUserId)
  if (!u) throw new Error('ログインが必要です')
  return u
}

function isAdmin(u: User) {
  return u.role === 'J-Navi管理者'
}

function isAgency(u: User) {
  return u.role === '代理店'
}

function isConnector(u: User) {
  return u.role === 'コネクター'
}

function canEditProduct(actor: User, _product: Product): boolean {
  return isAdmin(actor)
}

function logAppend(db: Db, entry: { actorUserId: string; action: string; detail: string; relatedId?: string }): Db {
  const newEntry = { id: uid('log'), at: nowIso(), ...entry }
  return { ...db, logs: [newEntry, ...db.logs].slice(0, 5000) }
}

function updateTransactionAllocations(
  tx: Transaction,
  updater: (alloc: Transaction['allocations'][number]) => Transaction['allocations'][number],
): Transaction {
  return { ...tx, allocations: tx.allocations.map(updater) }
}

function sumUserConfirmedAvailable(db: Db, userId: string): number {
  return db.transactions
    .flatMap((t) => t.allocations)
    .filter(
      (a) =>
        a.recipientType === 'ユーザー報酬' && a.userId === userId && a.status === '確定' && !a.payoutRequestId,
    )
    .reduce((sum, a) => sum + a.amountJPY, 0)
}

function initialDealStatusByProductType(productType: Product['type']): DealStatus {
  if (productType === 'hotel_membership') return '申し込み'
  if (productType === 'ad_slot') return '申し込み'
  return 'リード発生'
}

function revenueConfirmedStatusByProductType(productType: Product['type']): DealStatus {
  if (productType === 'hotel_membership') return '決済完了'
  if (productType === 'ad_slot') return '掲載開始'
  return '施工完了'
}

type DbContextValue = {
  db: Db
  actions: {
    resetAll: () => void

    // Auth
    login: (email: string, password: string) => { ok: boolean; message?: string }
    logout: () => void
    requestPasswordReset: (email: string) => { ok: boolean }
    resetPassword: (token: string, newPassword: string) => { ok: boolean; message?: string }
    changePassword: (currentPassword: string, newPassword: string) => { ok: boolean; message?: string }

    // Profile
    updateMyProfile: (payload: { name: string; email: string; bankAccount?: BankAccount }) => {
      ok: boolean
      message?: string
    }

    // Signup (connector)
    registerConnector: (payload: {
      agencyId: string
      introducedById?: string
      name: string
      email: string
      password: string
    }) => { ok: boolean; message?: string }

    // Admin: org
    adminSetConnectorAgency: (connectorUserId: string, agencyUserId: string) => { ok: boolean; message?: string }
    adminSetCommissionRates: (agencyRate: number, connectorRate: number) => { ok: boolean; message?: string }

    // Product management
    createProduct: (payload: Omit<Product, 'id'>) => { ok: boolean; message?: string; productId?: string }
    updateProduct: (productId: string, patch: Partial<Omit<Product, 'id' | 'supplierId'>>) => {
      ok: boolean
      message?: string
    }

    // Deals
    createDealFromReferral: (payload: {
      connectorId: string
      productId: string
      customerCompanyName: string
      customerName: string
      customerEmail: string
      customerPhone?: string
      memo?: string
    }) => { ok: boolean; message?: string; dealId?: string }

    createDealManual: (payload: {
      productId: string
      customerCompanyName: string
      customerName: string
      customerEmail: string
      customerPhone?: string
      memo?: string
    }) => { ok: boolean; message?: string; dealId?: string }

    updateDealStatus: (dealId: string, status: DealStatus) => { ok: boolean; message?: string }

    finalizeDeal: (payload: { dealId: string; finalSaleAmountJPY: number; closingDate: string }) => {
      ok: boolean
      message?: string
      transactionId?: string
    }

    // Rewards & payouts
    adminConfirmRewardsForTransaction: (transactionId: string) => { ok: boolean; message?: string }
    requestPayoutAll: () => { ok: boolean; message?: string; payoutRequestId?: string }
    adminMarkPayoutPaid: (payoutRequestId: string) => { ok: boolean; message?: string }
  }
}

const DbContext = createContext<DbContextValue | null>(null)

function loadDb(): Db {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return seedDb
  try {
    const parsed = JSON.parse(raw) as Db
    if (!parsed || parsed.schemaVersion !== 4) return seedDb
    return {
      ...seedDb,
      ...parsed,
      schemaVersion: 4,
    }
  } catch {
    return seedDb
  }
}

export function DbProvider(props: { children: React.ReactNode }) {
  const [db, setDb] = useState<Db>(() => loadDb())

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  }, [db])

  const actions = useMemo<DbContextValue['actions']>(() => {
    return {
      resetAll() {
        setDb(seedDb)
      },

      // --- Auth ---
      login(email, password) {
        const e = safeEmail(email)
        const user = db.users.find((u) => safeEmail(u.email) === e)
        if (!user) {
          return { ok: false, message: 'メールまたはパスワードが正しくありません' }
        }
        const ok = bcrypt.compareSync(password, user.passwordHash)
        if (!ok) return { ok: false, message: 'メールまたはパスワードが正しくありません' }

        setDb((prev) => {
          let next: Db = {
            ...prev,
            sessionUserId: user.id,
          }
          next = logAppend(next, {
            actorUserId: user.id,
            action: 'ログイン',
            detail: `login: ${user.email}`,
          })
          return next
        })
        return { ok: true }
      },

      logout() {
        setDb((prev) => {
          const actor = prev.sessionUserId ?? 'SYSTEM'
          let next: Db = { ...prev, sessionUserId: null }
          next = logAppend(next, { actorUserId: actor, action: 'ログアウト', detail: 'logout' })
          return next
        })
      },

      requestPasswordReset(email) {
        const user = findUserByEmail(db, email)
        // セキュリティ上: 存在しないメールでも常に ok
        if (!user) return { ok: true }

        const token = uid('pw')
        const now = Date.now()
        const expires = new Date(now + 1000 * 60 * 30)

        setDb((prev) => {
          let next = { ...prev }
          next.passwordResets = [
            {
              id: uid('pwr'),
              userId: user.id,
              token,
              requestedAt: nowIso(),
              expiresAt: expires.toISOString(),
            },
            ...next.passwordResets,
          ]

          next.outbox = [
            {
              id: uid('mail'),
              to: user.email,
              subject: '【デモ】パスワード再設定',
              body: `以下のリンクから再設定できます: ${window.location.origin}${window.location.pathname}#/reset?token=${token}`,
              sentAt: nowIso(),
            },
            ...next.outbox,
          ]

          next = logAppend(next, {
            actorUserId: user.id,
            action: 'PWリセット要求',
            detail: `token issued: ${token}`,
          })
          return next
        })

        return { ok: true }
      },

      resetPassword(token, newPassword) {
        const t = token.trim()
        if (!t) return { ok: false, message: 'トークンが不正です' }
        if (newPassword.length < 8) return { ok: false, message: 'パスワードは8文字以上にしてください' }

        const reset = db.passwordResets.find((r) => r.token === t)
        if (!reset) return { ok: false, message: 'トークンが見つかりません' }
        if (new Date(reset.expiresAt).getTime() < Date.now()) return { ok: false, message: 'トークンの有効期限が切れています' }

        setDb((prev) => {
          const hash = bcrypt.hashSync(newPassword, 10)
          const users = prev.users.map((u) => (u.id === reset.userId ? { ...u, passwordHash: hash } : u))
          let next: Db = { ...prev, users, passwordResets: prev.passwordResets.filter((r) => r.token !== t) }
          next = logAppend(next, {
            actorUserId: reset.userId,
            action: 'PWリセット',
            detail: 'password updated',
          })
          return next
        })
        return { ok: true }
      },

      changePassword(currentPassword, newPassword) {
        try {
          const me = requireSession(db)
          const ok = bcrypt.compareSync(currentPassword, me.passwordHash)
          if (!ok) return { ok: false, message: '現在のパスワードが正しくありません' }
          if (newPassword.length < 8) return { ok: false, message: 'パスワードは8文字以上にしてください' }

          setDb((prev) => {
            const hash = bcrypt.hashSync(newPassword, 10)
            const users = prev.users.map((u) => (u.id === me.id ? { ...u, passwordHash: hash } : u))
            let next: Db = { ...prev, users }
            next = logAppend(next, { actorUserId: me.id, action: 'PW変更', detail: 'password changed' })
            return next
          })

          return { ok: true }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '変更できませんでした' }
        }
      },

      // --- Profile ---
      updateMyProfile(payload) {
        try {
          const me = requireSession(db)
          const newEmail = safeEmail(payload.email)
          if (!payload.name.trim()) return { ok: false, message: '氏名を入力してください' }
          if (!newEmail) return { ok: false, message: 'メールを入力してください' }

          const conflict = db.users.find((u) => u.id !== me.id && safeEmail(u.email) === newEmail)
          if (conflict) return { ok: false, message: 'このメールアドレスは既に使用されています' }

          setDb((prev) => {
            const users = prev.users.map((u) =>
              u.id === me.id
                ? {
                    ...u,
                    name: payload.name,
                    email: newEmail,
                    bankAccount: payload.bankAccount,
                  }
                : u,
            )
            let next: Db = { ...prev, users }
            next = logAppend(next, { actorUserId: me.id, action: 'プロフィール更新', detail: 'profile updated' })
            return next
          })
          return { ok: true }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '更新できませんでした' }
        }
      },

      // --- Signup (Connector) ---
      registerConnector(payload) {
        const name = payload.name.trim()
        const email = safeEmail(payload.email)
        const password = payload.password
        const agencyId = payload.agencyId

        if (!name) return { ok: false, message: '氏名を入力してください' }
        if (!email) return { ok: false, message: 'メールアドレスを入力してください' }
        if (password.length < 8) return { ok: false, message: 'パスワードは8文字以上にしてください' }

        const agency = db.users.find((u) => u.id === agencyId && u.role === '代理店')
        if (!agency) return { ok: false, message: '所属代理店が見つかりません' }

        const exists = findUserByEmail(db, email)
        if (exists) return { ok: false, message: 'このメールアドレスは既に登録されています' }

        const newUser: User = {
          id: uid('usr'),
          role: 'コネクター',
          name,
          email,
          passwordHash: bcrypt.hashSync(password, 10),
          createdAt: nowIso(),
          connector: {
            agencyId,
            introducedById: payload.introducedById,
          },
        }

        setDb((prev) => {
          let next: Db = {
            ...prev,
            users: [newUser, ...prev.users],
            sessionUserId: newUser.id,
          }
          next = logAppend(next, {
            actorUserId: newUser.id,
            action: 'コネクター登録',
            detail: `agency=${agency.name}`,
            relatedId: newUser.id,
          })
          return next
        })

        return { ok: true }
      },

      // --- Admin: org ---
      adminSetConnectorAgency(connectorUserId, agencyUserId) {
        try {
          const actor = requireSession(db)
          if (!isAdmin(actor)) return { ok: false, message: '権限がありません' }

          const agency = db.users.find((u) => u.id === agencyUserId && u.role === '代理店')
          if (!agency) return { ok: false, message: '代理店が見つかりません' }

          const connector = db.users.find((u) => u.id === connectorUserId && u.role === 'コネクター')
          if (!connector || !connector.connector) return { ok: false, message: 'コネクターが見つかりません' }

          setDb((prev) => {
            const users = prev.users.map((u) =>
              u.id === connectorUserId
                ? {
                    ...u,
                    connector: { ...u.connector!, agencyId: agencyUserId },
                  }
                : u,
            )
            let next: Db = { ...prev, users }
            next = logAppend(next, {
              actorUserId: actor.id,
              action: '所属代理店変更',
              detail: `${connector.name} → ${agency.name}`,
              relatedId: connectorUserId,
            })
            return next
          })
          return { ok: true }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '更新できませんでした' }
        }
      },

      adminSetCommissionRates(agencyRate, connectorRate) {
        try {
          const actor = requireSession(db)
          if (!isAdmin(actor)) return { ok: false, message: '権限がありません' }

          if (!(agencyRate >= 0 && agencyRate <= 1)) return { ok: false, message: '報酬総額率が不正です' }
          if (!(connectorRate >= 0 && connectorRate <= 1)) return { ok: false, message: 'コネクター率が不正です' }
          if (connectorRate > agencyRate) return { ok: false, message: 'コネクター率は報酬総額率以下にしてください' }

          setDb((prev) => {
            let next: Db = {
              ...prev,
              settings: {
                ...prev.settings,
                agencyRate,
                connectorRate,
              },
            }
            next = logAppend(next, {
              actorUserId: actor.id,
              action: '報酬率変更',
              detail: `agency=${agencyRate} connector=${connectorRate}`,
            })
            return next
          })

          return { ok: true }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '更新できませんでした' }
        }
      },

      // --- Products ---
      createProduct(payload) {
        try {
          const actor = requireSession(db)
          if (!isAdmin(actor)) return { ok: false, message: '権限がありません' }

          if (!payload.supplierId) return { ok: false, message: 'supplierId が不正です' }

          const id = uid('prd')
          const product: Product = { ...payload, id, supplierId: payload.supplierId }

          setDb((prev) => {
            let next: Db = { ...prev, products: [product, ...prev.products] }
            next = logAppend(next, { actorUserId: actor.id, action: '商品作成', detail: product.name, relatedId: id })
            return next
          })

          return { ok: true, productId: id }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '作成できませんでした' }
        }
      },

      updateProduct(productId, patch) {
        try {
          const actor = requireSession(db)
          const product = db.products.find((p) => p.id === productId)
          if (!product) return { ok: false, message: '商品が見つかりません' }
          if (!canEditProduct(actor, product)) return { ok: false, message: '権限がありません' }

          setDb((prev) => {
            const products = prev.products.map((p) => (p.id === productId ? { ...p, ...patch } : p))
            let next: Db = { ...prev, products }
            next = logAppend(next, {
              actorUserId: actor.id,
              action: '商品更新',
              detail: `${product.name}`,
              relatedId: productId,
            })
            return next
          })

          return { ok: true }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '更新できませんでした' }
        }
      },

      // --- Deals ---
      createDealFromReferral(payload) {
        try {
          const product = db.products.find((p) => p.id === payload.productId)
          if (!product) return { ok: false, message: '商品が見つかりません' }
          if (!product.isPublic) return { ok: false, message: 'この商品は現在受付停止中です' }

          const connector = db.users.find((u) => u.id === payload.connectorId)
          if (!connector || connector.role !== 'コネクター') {
            return { ok: false, message: 'コネクターが見つかりません' }
          }

          const deal: Deal = {
            id: uid('deal'),
            createdAt: nowIso(),
            locked: false,
            status: initialDealStatusByProductType(product.type),
            connectorId: connector.id,
            productId: product.id,
            customerCompanyName: payload.customerCompanyName,
            customerName: payload.customerName,
            customerEmail: payload.customerEmail,
            customerPhone: payload.customerPhone,
            memo: payload.memo,
            source: '紹介LP',
          }

          setDb((prev) => {
            let next: Db = { ...prev, deals: [deal, ...prev.deals] }
            next = logAppend(next, {
              actorUserId: 'SYSTEM',
              action: 'リード登録',
              detail: `${product.name} / connector=${connector.name}`,
              relatedId: deal.id,
            })
            return next
          })

          return { ok: true, dealId: deal.id }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '登録できませんでした' }
        }
      },

      createDealManual(payload) {
        try {
          const actor = requireSession(db)
          if (!(isConnector(actor) || isAdmin(actor))) return { ok: false, message: '権限がありません' }

          const product = db.products.find((p) => p.id === payload.productId)
          if (!product) return { ok: false, message: '商品が見つかりません' }

          const deal: Deal = {
            id: uid('deal'),
            createdAt: nowIso(),
            locked: false,
            status: initialDealStatusByProductType(product.type),
            connectorId: actor.id,
            productId: product.id,
            customerCompanyName: payload.customerCompanyName,
            customerName: payload.customerName,
            customerEmail: payload.customerEmail,
            customerPhone: payload.customerPhone,
            memo: payload.memo,
            source: '手動',
          }

          setDb((prev) => {
            let next: Db = { ...prev, deals: [deal, ...prev.deals] }
            next = logAppend(next, { actorUserId: actor.id, action: '商談登録', detail: product.name, relatedId: deal.id })
            return next
          })

          return { ok: true, dealId: deal.id }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '登録できませんでした' }
        }
      },

      updateDealStatus(dealId, status) {
        try {
          const actor = requireSession(db)
          const deal = db.deals.find((d) => d.id === dealId)
          if (!deal) return { ok: false, message: '商談が見つかりません' }
          if (deal.locked) return { ok: false, message: '売上確定済みの商談は編集できません' }

          // 権限チェック
          if (!isAdmin(actor)) {
            if (isConnector(actor) && deal.connectorId !== actor.id) return { ok: false, message: '権限がありません' }
            if (isAgency(actor)) {
              const connector = db.users.find((u) => u.id === deal.connectorId)
              if (connector?.connector?.agencyId !== actor.id) return { ok: false, message: '権限がありません' }
            }
            if (!(isConnector(actor) || isAgency(actor))) return { ok: false, message: '権限がありません' }
          }

          setDb((prev) => {
            const deals = prev.deals.map((d) => (d.id === dealId ? { ...d, status } : d))
            let next: Db = { ...prev, deals }
            next = logAppend(next, {
              actorUserId: actor.id,
              action: 'ステータス更新',
              detail: `${dealId} → ${status}`,
              relatedId: dealId,
            })
            return next
          })

          return { ok: true }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '更新できませんでした' }
        }
      },

      finalizeDeal(payload) {
        try {
          const actor = requireSession(db)
          const deal = db.deals.find((d) => d.id === payload.dealId)
          if (!deal) return { ok: false, message: '商談が見つかりません' }
          if (deal.locked) return { ok: false, message: '既に売上確定済みです' }

          const product = db.products.find((p) => p.id === deal.productId)
          if (!product) return { ok: false, message: '商品が見つかりません' }

          // 権限チェック: admin / 当事者コネクター / 所属代理店
          if (!isAdmin(actor)) {
            if (isConnector(actor) && deal.connectorId !== actor.id) return { ok: false, message: '権限がありません' }
            if (isAgency(actor)) {
              const connector = db.users.find((u) => u.id === deal.connectorId)
              if (connector?.connector?.agencyId !== actor.id) return { ok: false, message: '権限がありません' }
            }
            if (!(isConnector(actor) || isAgency(actor))) return { ok: false, message: '権限がありません' }
          }

          const connector = db.users.find((u) => u.id === deal.connectorId)
          if (!connector || connector.role !== 'コネクター' || !connector.connector) {
            return { ok: false, message: 'コネクター情報が不正です' }
          }
          const agency = db.users.find((u) => u.id === connector.connector!.agencyId)
          if (!agency || agency.role !== '代理店') return { ok: false, message: '所属代理店が見つかりません' }

          const sale = payload.finalSaleAmountJPY
          if (!(sale > 0)) return { ok: false, message: '金額が不正です' }
          const closingDate = payload.closingDate
          if (!/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) return { ok: false, message: '日付は YYYY-MM-DD 形式です' }

          const baseAmountJPY = sale
          const ratesUsed = { agencyRate: db.settings.agencyRate, connectorRate: db.settings.connectorRate }
          const amounts = calculateModelAAmounts({ baseAmountJPY, ...ratesUsed })

          const initStatus: RewardStatus = initialRewardStatusForProductType(product.type)

          const txId = uid('tx')
          const tx: Transaction = {
            id: txId,
            createdAt: nowIso(),
            dealId: deal.id,
            closingDate,
            productSnapshot: {
              productId: product.id,
              name: product.name,
              category: product.category,
              type: product.type,
              supplierId: product.supplierId,
              listPriceJPY: product.listPriceJPY,
            },
            connectorId: connector.id,
            agencyId: agency.id,
            saleAmountJPY: sale,
            baseAmountJPY: amounts.baseAmountJPY,
            ratesUsed,
            agencyRewardJPY: amounts.agencyRewardJPY,
            connectorRewardJPY: amounts.connectorRewardJPY,
            jnaviShareJPY: amounts.jnaviShareJPY,
            allocations: [
              {
                id: uid('alloc'),
                recipientType: 'ユーザー報酬',
                userId: agency.id,
                userRole: '代理店',
                label: `代理店報酬（${Math.round((ratesUsed.agencyRate - ratesUsed.connectorRate) * 1000) / 10}%）`,
                rate: ratesUsed.agencyRate - ratesUsed.connectorRate,
                baseAmountJPY: amounts.baseAmountJPY,
                amountJPY: amounts.agencyRewardJPY,
                status: initStatus,
              },
              {
                id: uid('alloc'),
                recipientType: 'ユーザー報酬',
                userId: connector.id,
                userRole: 'コネクター',
                label: 'コネクター報酬（5%）',
                rate: ratesUsed.connectorRate,
                baseAmountJPY: amounts.baseAmountJPY,
                amountJPY: amounts.connectorRewardJPY,
                status: initStatus,
              },
              {
                id: uid('alloc'),
                recipientType: 'Jnavi取り分',
                label: 'Jnavi取り分（残余）',
                amountJPY: amounts.jnaviShareJPY,
              },
            ],
          }

          const nextDealStatus = revenueConfirmedStatusByProductType(product.type)

          setDb((prev) => {
            let next: Db = { ...prev }

            next.deals = prev.deals.map((d) =>
              d.id === deal.id
                ? {
                    ...d,
                    locked: true,
                    status: nextDealStatus,
                    finalSaleAmountJPY: sale,
                    closingDate,
                  }
                : d,
            )

            next.transactions = [tx, ...prev.transactions]

            next = logAppend(next, {
              actorUserId: actor.id,
              action: '売上確定',
              detail: `${deal.id} / ${product.name} / ${agency.name}に${Math.round((ratesUsed.agencyRate - ratesUsed.connectorRate) * 1000) / 10}%、${connector.name}に${Math.round(ratesUsed.connectorRate * 1000) / 10}%`,
              relatedId: deal.id,
            })

            return next
          })

          return { ok: true, transactionId: txId }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '確定できませんでした' }
        }
      },

      // --- Rewards ---
      adminConfirmRewardsForTransaction(transactionId) {
        try {
          const actor = requireSession(db)
          if (!isAdmin(actor)) return { ok: false, message: '権限がありません' }

          const tx = db.transactions.find((t) => t.id === transactionId)
          if (!tx) return { ok: false, message: '取引が見つかりません' }

          setDb((prev) => {
            const transactions = prev.transactions.map((t) => {
              if (t.id !== transactionId) return t
              return updateTransactionAllocations(t, (a) => {
                if (a.recipientType !== 'ユーザー報酬') return a
                if (a.status !== '未確定') return a
                return { ...a, status: '確定' }
              })
            })
            let next: Db = { ...prev, transactions }
            next = logAppend(next, {
              actorUserId: actor.id,
              action: '報酬確定',
              detail: `transaction=${transactionId}`,
              relatedId: transactionId,
            })
            return next
          })

          return { ok: true }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '確定できませんでした' }
        }
      },

      requestPayoutAll() {
        try {
          const me = requireSession(db)
          if (!(isAgency(me) || isConnector(me))) return { ok: false, message: '権限がありません' }

          const available = sumUserConfirmedAvailable(db, me.id)
          if (available < db.settings.minPayoutJPY) {
            return { ok: false, message: `出金可能額が最低金額（${db.settings.minPayoutJPY}円）に達していません` }
          }

          const allocationIds = db.transactions
            .flatMap((t) => t.allocations)
            .filter(
              (a) =>
                a.recipientType === 'ユーザー報酬' && a.userId === me.id && a.status === '確定' && !a.payoutRequestId,
            )
            .map((a) => a.id)

          const payoutId = uid('payout')
          const payout: PayoutRequest = {
            id: payoutId,
            userId: me.id,
            requestedAt: nowIso(),
            amountJPY: available,
            status: '申請中',
            allocationIds,
          }

          setDb((prev) => {
            // allocations に payoutRequestId を付与
            const transactions = prev.transactions.map((t) =>
              updateTransactionAllocations(t, (a) => {
                if (a.recipientType !== 'ユーザー報酬') return a
                if (a.userId !== me.id) return a
                if (a.status !== '確定') return a
                if (a.payoutRequestId) return a
                return { ...a, payoutRequestId: payoutId }
              }),
            )

            let next: Db = {
              ...prev,
              payoutRequests: [payout, ...prev.payoutRequests],
              transactions,
            }

            next = logAppend(next, {
              actorUserId: me.id,
              action: '出金申請',
              detail: `${payoutId} / ${available}円`,
              relatedId: payoutId,
            })

            return next
          })

          return { ok: true, payoutRequestId: payoutId }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '申請できませんでした' }
        }
      },

      adminMarkPayoutPaid(payoutRequestId) {
        try {
          const actor = requireSession(db)
          if (!isAdmin(actor)) return { ok: false, message: '権限がありません' }

          const pr = db.payoutRequests.find((p) => p.id === payoutRequestId)
          if (!pr) return { ok: false, message: '出金申請が見つかりません' }
          if (pr.status === '支払済み') return { ok: false, message: '既に支払済みです' }

          setDb((prev) => {
            const payoutRequests = prev.payoutRequests.map((p) =>
              p.id === payoutRequestId ? { ...p, status: '支払済み', processedAt: nowIso() } : p,
            )

            const transactions = prev.transactions.map((t) =>
              updateTransactionAllocations(t, (a) => {
                if (a.recipientType !== 'ユーザー報酬') return a
                if (a.payoutRequestId !== payoutRequestId) return a
                return { ...a, status: '支払済み' }
              }),
            )

            let next: Db = { ...prev, payoutRequests, transactions }
            next = logAppend(next, {
              actorUserId: actor.id,
              action: '出金支払',
              detail: `${payoutRequestId} / user=${pr.userId}`,
              relatedId: payoutRequestId,
            })
            return next
          })

          return { ok: true }
        } catch (e: any) {
          return { ok: false, message: e?.message ?? '更新できませんでした' }
        }
      },
    }
  }, [db])

  const value: DbContextValue = useMemo(() => ({ db, actions }), [db, actions])

  return <DbContext.Provider value={value}>{props.children}</DbContext.Provider>
}

export function useDb(): DbContextValue {
  const ctx = useContext(DbContext)
  if (!ctx) throw new Error('DbProvider が見つかりません')
  return ctx
}

export function getSessionUser(db: Db): User | null {
  return db.sessionUserId ? db.users.find((u) => u.id === db.sessionUserId) ?? null : null
}

export function getRoleHomePath(user: User): string {
  if (user.role === 'J-Navi管理者') return '/admin'
  return '/dashboard'
}

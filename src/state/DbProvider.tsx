import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type {
  Allocation,
  BankAccount,
  Db,
  Deal,
  DealStatus,
  Mail,
  OperationLog,
  PayoutRequest,
  Product,
  Supplier,
  SystemSettings,
  Transaction,
  User,
  UserRole,
} from './types'
import { calculateModelAAmounts, initialRewardStatusForProductType } from '../utils/reward'

// ---- helpers ----

function safeEmail(email: string) {
  return email.trim().toLowerCase()
}

// DB → Frontend の型変換ヘルパー
function mapProfile(row: any): User {
  return {
    id: row.id,
    role: row.role as UserRole,
    name: row.name,
    email: row.email,
    passwordHash: '', // Supabase Auth が管理
    createdAt: row.created_at,
    bankAccount: row.bank_account ?? undefined,
    agency: row.invite_code ? { inviteCode: row.invite_code } : undefined,
    connector:
      row.agency_id
        ? { agencyId: row.agency_id, introducedById: row.introduced_by_id ?? undefined }
        : undefined,
  }
}

function mapSupplier(row: any): Supplier {
  return { id: row.id, name: row.name, note: row.note ?? undefined }
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    name: row.name,
    category: row.category,
    type: row.type,
    listPriceJPY: row.list_price_jpy,
    imageUrl: row.image_url ?? undefined,
    description: row.description,
    materials: row.materials ?? [],
    isPublic: row.is_public,
    adSpec: row.ad_spec ?? undefined,
    vacancyStatus: row.vacancy_status ?? undefined,
  }
}

function mapDeal(row: any): Deal {
  return {
    id: row.id,
    createdAt: row.created_at,
    locked: row.locked,
    status: row.status as DealStatus,
    connectorId: row.connector_id,
    productId: row.product_id,
    customerCompanyName: row.customer_company_name,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone ?? undefined,
    memo: row.memo ?? undefined,
    source: row.source,
    finalSaleAmountJPY: row.final_sale_amount_jpy ?? undefined,
    closingDate: row.closing_date ?? undefined,
  }
}

function mapAllocation(row: any): Allocation {
  if (row.recipient_type === 'Jnavi取り分') {
    return {
      id: row.id,
      recipientType: 'Jnavi取り分',
      label: row.label,
      amountJPY: row.amount_jpy,
    }
  }
  return {
    id: row.id,
    recipientType: 'ユーザー報酬',
    userId: row.user_id,
    userRole: row.user_role,
    label: row.label,
    rate: Number(row.rate),
    baseAmountJPY: row.base_amount_jpy,
    amountJPY: row.amount_jpy,
    status: row.status,
    payoutRequestId: row.payout_request_id ?? undefined,
  }
}

function mapTransaction(row: any, allocations: Allocation[]): Transaction {
  return {
    id: row.id,
    createdAt: row.created_at,
    dealId: row.deal_id,
    closingDate: row.closing_date,
    productSnapshot: row.product_snapshot,
    connectorId: row.connector_id,
    agencyId: row.agency_id,
    saleAmountJPY: row.sale_amount_jpy,
    baseAmountJPY: row.base_amount_jpy,
    ratesUsed: row.rates_used,
    agencyRewardJPY: row.agency_reward_jpy,
    connectorRewardJPY: row.connector_reward_jpy,
    jnaviShareJPY: row.jnavi_share_jpy,
    allocations,
  }
}

function mapPayoutRequest(row: any): PayoutRequest {
  return {
    id: row.id,
    userId: row.user_id,
    requestedAt: row.requested_at,
    amountJPY: row.amount_jpy,
    status: row.status,
    allocationIds: [], // 別途解決
    processedAt: row.processed_at ?? undefined,
  }
}

function mapMail(row: any): Mail {
  return {
    id: row.id,
    to: row.to_address,
    subject: row.subject,
    body: row.body,
    sentAt: row.sent_at,
  }
}

function mapLog(row: any): OperationLog {
  return {
    id: row.id,
    at: row.at,
    actorUserId: row.actor_user_id,
    action: row.action,
    detail: row.detail,
    relatedId: row.related_id ?? undefined,
  }
}

// ---- Context ----

type ActionResult = { ok: boolean; message?: string }
type ActionResultWithId<K extends string> = ActionResult & Partial<Record<K, string>>

type DbContextValue = {
  db: Db | null
  loading: boolean
  actions: {
    resetAll: () => Promise<void>

    // Auth
    login: (email: string, password: string) => Promise<ActionResult>
    logout: () => Promise<void>
    requestPasswordReset: (email: string) => Promise<ActionResult>
    resetPassword: (token: string, newPassword: string) => Promise<ActionResult>
    changePassword: (currentPassword: string, newPassword: string) => Promise<ActionResult>

    // Profile
    updateMyProfile: (payload: {
      name: string
      email: string
      bankAccount?: BankAccount
    }) => Promise<ActionResult>

    // Signup (connector)
    registerConnector: (payload: {
      agencyId: string
      introducedById?: string
      name: string
      email: string
      password: string
    }) => Promise<ActionResult>

    // Admin: org
    adminSetConnectorAgency: (
      connectorUserId: string,
      agencyUserId: string,
    ) => Promise<ActionResult>
    adminSetCommissionRates: (agencyRate: number, connectorRate: number) => Promise<ActionResult>

    // Product management
    createProduct: (
      payload: Omit<Product, 'id'>,
    ) => Promise<ActionResultWithId<'productId'>>
    updateProduct: (
      productId: string,
      patch: Partial<Omit<Product, 'id' | 'supplierId'>>,
    ) => Promise<ActionResult>

    // Deals
    createDealFromReferral: (payload: {
      connectorId: string
      productId: string
      customerCompanyName: string
      customerName: string
      customerEmail: string
      customerPhone?: string
      memo?: string
    }) => Promise<ActionResultWithId<'dealId'>>

    createDealManual: (payload: {
      productId: string
      customerCompanyName: string
      customerName: string
      customerEmail: string
      customerPhone?: string
      memo?: string
    }) => Promise<ActionResultWithId<'dealId'>>

    updateDealStatus: (dealId: string, status: DealStatus) => Promise<ActionResult>

    finalizeDeal: (payload: {
      dealId: string
      finalSaleAmountJPY: number
      closingDate: string
    }) => Promise<ActionResultWithId<'transactionId'>>

    // Rewards & payouts
    adminConfirmRewardsForTransaction: (transactionId: string) => Promise<ActionResult>
    requestPayoutAll: () => Promise<ActionResultWithId<'payoutRequestId'>>
    adminMarkPayoutPaid: (payoutRequestId: string) => Promise<ActionResult>
  }
}

const DbContext = createContext<DbContextValue | null>(null)

// ---- Provider ----

export function DbProvider(props: { children: React.ReactNode }) {
  const [db, setDb] = useState<Db | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)

  // データ全読み込み
  const loadAllData = useCallback(async (userId: string | null) => {
    try {
      const [
        profilesRes,
        suppliersRes,
        productsRes,
        dealsRes,
        transactionsRes,
        allocationsRes,
        payoutsRes,
        settingsRes,
        outboxRes,
        logsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('products').select('*'),
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('allocations').select('*'),
        supabase.from('payout_requests').select('*').order('requested_at', { ascending: false }),
        supabase.from('system_settings').select('*').eq('id', 1).single(),
        supabase.from('outbox').select('*').order('sent_at', { ascending: false }),
        supabase.from('operation_logs').select('*').order('at', { ascending: false }).limit(5000),
      ])

      const users = (profilesRes.data ?? []).map(mapProfile)
      const suppliers = (suppliersRes.data ?? []).map(mapSupplier)
      const products = (productsRes.data ?? []).map(mapProduct)
      const deals = (dealsRes.data ?? []).map(mapDeal)

      // allocations をトランザクションごとにグループ化
      const allocsByTx = new Map<string, Allocation[]>()
      for (const row of allocationsRes.data ?? []) {
        const txId = row.transaction_id
        if (!allocsByTx.has(txId)) allocsByTx.set(txId, [])
        allocsByTx.get(txId)!.push(mapAllocation(row))
      }

      const transactions = (transactionsRes.data ?? []).map((row: any) =>
        mapTransaction(row, allocsByTx.get(row.id) ?? []),
      )

      // payoutRequests に allocationIds を付与
      const allAllocations = allocationsRes.data ?? []
      const payoutRequests: PayoutRequest[] = (payoutsRes.data ?? []).map((row: any) => ({
        ...mapPayoutRequest(row),
        allocationIds: allAllocations
          .filter((a: any) => a.payout_request_id === row.id)
          .map((a: any) => a.id),
      }))

      const settings: SystemSettings = settingsRes.data
        ? {
            minPayoutJPY: settingsRes.data.min_payout_jpy,
            agencyRate: Number(settingsRes.data.agency_rate),
            connectorRate: Number(settingsRes.data.connector_rate),
          }
        : { minPayoutJPY: 5000, agencyRate: 0.15, connectorRate: 0.05 }

      const outbox = (outboxRes.data ?? []).map(mapMail)
      const logs = (logsRes.data ?? []).map(mapLog)

      setDb({
        schemaVersion: 4,
        sessionUserId: userId,
        users,
        suppliers,
        products,
        deals,
        transactions,
        payoutRequests,
        settings,
        outbox,
        passwordResets: [], // Supabase Auth が管理
        logs,
      })
    } catch (err) {
      console.error('データ読み込みエラー:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Auth state listener
  useEffect(() => {
    // 現在のセッションチェック
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null
      setSessionUserId(uid)
      loadAllData(uid)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id ?? null
      setSessionUserId(uid)
      if (uid) {
        loadAllData(uid)
      } else {
        // ログアウト時もデータは保持（公開ページ用）
        setDb((prev) => (prev ? { ...prev, sessionUserId: null } : null))
      }
    })

    return () => subscription.unsubscribe()
  }, [loadAllData])

  // リフレッシュヘルパー
  const refresh = useCallback(() => loadAllData(sessionUserId), [loadAllData, sessionUserId])

  const actions = useMemo<DbContextValue['actions']>(() => {
    return {
      // --- Reset (dev/demo用) ---
      async resetAll() {
        // 本番では無効化推奨
        console.warn('resetAll is not available in production mode')
      },

      // --- Auth ---
      async login(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: safeEmail(email),
          password,
        })
        if (error) return { ok: false, message: 'メールまたはパスワードが正しくありません' }
        return { ok: true }
      },

      async logout() {
        await supabase.auth.signOut()
      },

      async requestPasswordReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(safeEmail(email), {
          redirectTo: `${window.location.origin}/reset`,
        })
        if (error) {
          console.error('Password reset error:', error)
        }
        // セキュリティ上: 常に ok 返却
        return { ok: true }
      },

      async resetPassword(_token, newPassword) {
        if (newPassword.length < 8) {
          return { ok: false, message: 'パスワードは8文字以上にしてください' }
        }
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) return { ok: false, message: error.message }
        return { ok: true }
      },

      async changePassword(_currentPassword, newPassword) {
        if (newPassword.length < 8) {
          return { ok: false, message: 'パスワードは8文字以上にしてください' }
        }
        // Supabase Auth では現在パスワードの検証は signInWithPassword で行う
        // ここでは簡易的に updateUser のみ
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) return { ok: false, message: error.message }
        return { ok: true }
      },

      // --- Profile ---
      async updateMyProfile(payload) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { ok: false, message: 'ログインが必要です' }

        if (!payload.name.trim()) return { ok: false, message: '氏名を入力してください' }
        if (!payload.email.trim()) return { ok: false, message: 'メールを入力してください' }

        const { error } = await supabase
          .from('profiles')
          .update({
            name: payload.name.trim(),
            email: safeEmail(payload.email),
            bank_account: payload.bankAccount ?? null,
          })
          .eq('id', user.id)

        if (error) {
          if (error.code === '23505') return { ok: false, message: 'このメールアドレスは既に使用されています' }
          return { ok: false, message: error.message }
        }

        // Supabase Auth のメールも更新
        if (safeEmail(payload.email) !== safeEmail(user.email ?? '')) {
          await supabase.auth.updateUser({ email: safeEmail(payload.email) })
        }

        await refresh()
        return { ok: true }
      },

      // --- Signup (Connector) ---
      async registerConnector(payload) {
        const name = payload.name.trim()
        const email = safeEmail(payload.email)
        const password = payload.password

        if (!name) return { ok: false, message: '氏名を入力してください' }
        if (!email) return { ok: false, message: 'メールアドレスを入力してください' }
        if (password.length < 8) return { ok: false, message: 'パスワードは8文字以上にしてください' }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'コネクター',
              name,
              agency_id: payload.agencyId,
              introduced_by_id: payload.introducedById ?? '',
            },
          },
        })

        if (error) {
          if (error.message.includes('already registered')) {
            return { ok: false, message: 'このメールアドレスは既に登録されています' }
          }
          return { ok: false, message: error.message }
        }

        return { ok: true }
      },

      // --- Admin: org ---
      async adminSetConnectorAgency(connectorUserId, agencyUserId) {
        const { error } = await supabase
          .from('profiles')
          .update({ agency_id: agencyUserId })
          .eq('id', connectorUserId)
          .eq('role', 'コネクター')

        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true }
      },

      async adminSetCommissionRates(agencyRate, connectorRate) {
        if (!(agencyRate >= 0 && agencyRate <= 1)) return { ok: false, message: '報酬総額率が不正です' }
        if (!(connectorRate >= 0 && connectorRate <= 1)) return { ok: false, message: 'コネクター率が不正です' }
        if (connectorRate > agencyRate) return { ok: false, message: 'コネクター率は報酬総額率以下にしてください' }

        const { error } = await supabase
          .from('system_settings')
          .update({ agency_rate: agencyRate, connector_rate: connectorRate })
          .eq('id', 1)

        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true }
      },

      // --- Products ---
      async createProduct(payload) {
        const { data, error } = await supabase
          .from('products')
          .insert({
            supplier_id: payload.supplierId,
            name: payload.name,
            category: payload.category,
            type: payload.type,
            list_price_jpy: payload.listPriceJPY,
            image_url: payload.imageUrl ?? null,
            description: payload.description,
            materials: payload.materials,
            is_public: payload.isPublic,
            ad_spec: payload.adSpec ?? null,
            vacancy_status: payload.vacancyStatus ?? null,
          })
          .select('id')
          .single()

        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true, productId: data.id }
      },

      async updateProduct(productId, patch) {
        const updateData: Record<string, any> = {}
        if (patch.name !== undefined) updateData.name = patch.name
        if (patch.category !== undefined) updateData.category = patch.category
        if (patch.type !== undefined) updateData.type = patch.type
        if (patch.listPriceJPY !== undefined) updateData.list_price_jpy = patch.listPriceJPY
        if (patch.imageUrl !== undefined) updateData.image_url = patch.imageUrl
        if (patch.description !== undefined) updateData.description = patch.description
        if (patch.materials !== undefined) updateData.materials = patch.materials
        if (patch.isPublic !== undefined) updateData.is_public = patch.isPublic
        if (patch.adSpec !== undefined) updateData.ad_spec = patch.adSpec
        if (patch.vacancyStatus !== undefined) updateData.vacancy_status = patch.vacancyStatus

        const { error } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', productId)

        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true }
      },

      // --- Deals ---
      async createDealFromReferral(payload) {
        const { data, error } = await supabase.rpc('create_referral_deal', {
          p_connector_id: payload.connectorId,
          p_product_id: payload.productId,
          p_customer_company_name: payload.customerCompanyName,
          p_customer_name: payload.customerName,
          p_customer_email: payload.customerEmail,
          p_customer_phone: payload.customerPhone ?? null,
          p_memo: payload.memo ?? null,
        })

        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true, dealId: data }
      },

      async createDealManual(payload) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { ok: false, message: 'ログインが必要です' }

        // 商品タイプに応じた初期ステータスを取得
        const { data: product } = await supabase
          .from('products')
          .select('type')
          .eq('id', payload.productId)
          .single()

        let initialStatus: DealStatus = 'リード発生'
        if (product) {
          if (product.type === 'hotel_membership' || product.type === 'ad_slot') {
            initialStatus = '申し込み'
          }
        }

        const { data, error } = await supabase
          .from('deals')
          .insert({
            connector_id: user.id,
            product_id: payload.productId,
            status: initialStatus,
            customer_company_name: payload.customerCompanyName,
            customer_name: payload.customerName,
            customer_email: payload.customerEmail,
            customer_phone: payload.customerPhone ?? null,
            memo: payload.memo ?? null,
            source: '手動',
          })
          .select('id')
          .single()

        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true, dealId: data.id }
      },

      async updateDealStatus(dealId, status) {
        const { error } = await supabase
          .from('deals')
          .update({ status })
          .eq('id', dealId)
          .eq('locked', false)

        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true }
      },

      async finalizeDeal(payload) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.closingDate)) {
          return { ok: false, message: '日付は YYYY-MM-DD 形式です' }
        }

        const { data, error } = await supabase.rpc('finalize_deal', {
          p_deal_id: payload.dealId,
          p_final_sale_amount_jpy: payload.finalSaleAmountJPY,
          p_closing_date: payload.closingDate,
        })

        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true, transactionId: data }
      },

      // --- Rewards ---
      async adminConfirmRewardsForTransaction(transactionId) {
        const { error } = await supabase.rpc('admin_confirm_rewards', {
          p_transaction_id: transactionId,
        })
        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true }
      },

      async requestPayoutAll() {
        const { data, error } = await supabase.rpc('request_payout_all')
        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true, payoutRequestId: data }
      },

      async adminMarkPayoutPaid(payoutRequestId) {
        const { error } = await supabase.rpc('admin_mark_payout_paid', {
          p_payout_request_id: payoutRequestId,
        })
        if (error) return { ok: false, message: error.message }
        await refresh()
        return { ok: true }
      },
    }
  }, [refresh, sessionUserId])

  const value: DbContextValue = useMemo(() => ({ db, loading, actions }), [db, loading, actions])

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

// ----
// J-Navi 営業マッチングプラットフォーム（デモ）
// 3層フラット構造: Jnavi運営 → 代理店 → コネクター
// ----

export type UserRole = 'J-Navi管理者' | '代理店' | 'コネクター'

export type BankAccount = {
  bankName: string
  branchName: string
  accountType: '普通' | '当座'
  accountNumber: string
  accountHolder: string
}

export type AgencyProfile = {
  /** コネクター登録用の招待コード */
  inviteCode: string
}

export type ConnectorProfile = {
  /** 所属する代理店の userId */
  agencyId: string
  /** 紹介者（参考データ）※組織図・報酬計算には使用しない */
  introducedById?: string
}

export type User = {
  id: string
  role: UserRole
  name: string
  email: string
  /** bcrypt のハッシュ（デモでは bcryptjs を使用） */
  passwordHash: string
  createdAt: string // ISO
  bankAccount?: BankAccount

  agency?: AgencyProfile
  connector?: ConnectorProfile
}

export type Supplier = {
  id: string
  name: string
  note?: string
}

export type ProductCategory = 'サイネージ' | 'ホテル' | '広告枠'

export type ProductType = 'signage' | 'hotel_membership' | 'ad_slot'

export type AdSpec = {
  /** 設置場所（住所） */
  address: string
  /** Google Map などのリンク（任意） */
  mapUrl?: string
  /** サイズ（例: 55インチ / H2000×W3000 など） */
  size: string
  /** 再生頻度（例: 10秒×6枠/時 など） */
  playbackFrequency: string
}

export type VacancyStatus = '募集中' | '売切'

export type Product = {
  id: string
  supplierId: string
  name: string
  category: ProductCategory
  type: ProductType
  /** 参考価格（窓ガラスサイネージ=案件売上、広告枠=月額等、ホテル会員権=販売価格） */
  listPriceJPY: number
  imageUrl?: string
  description: string
  materials: { label: string; href: string }[]
  /** 公開/非公開（在庫切れ等） */
  isPublic: boolean

  /** 広告枠（商品）専用 */
  adSpec?: AdSpec
  vacancyStatus?: VacancyStatus
}

export type DealStatus =
  | 'リード発生'
  | '商談中'
  | '契約締結'
  | '施工完了'
  | '申し込み'
  | '決済完了'
  | '審査'
  | '掲載開始'
  | '失注'

export type DealSource = '紹介LP' | '手動'

export type Deal = {
  id: string
  createdAt: string // ISO
  /** 売上確定後はロックして金額等を編集不可にする */
  locked: boolean
  status: DealStatus

  /** この商談を担当するコネクター（＝紹介リンクを発行した人/手動登録した人） */
  connectorId: string
  productId: string

  customerCompanyName: string
  customerName: string
  customerEmail: string
  customerPhone?: string
  memo?: string

  source: DealSource

  /** 売上確定時に入力 */
  finalSaleAmountJPY?: number
  closingDate?: string // YYYY-MM-DD
}

export type RewardStatus = '未確定' | '確定' | '支払済み'

export type UserRewardAllocation = {
  id: string
  recipientType: 'ユーザー報酬'
  userId: string
  userRole: '代理店' | 'コネクター'
  label: string
  /** 例: 0.15 = 15% */
  rate: number
  /** 計算対象額（今回は売上ベースを仮定） */
  baseAmountJPY: number
  amountJPY: number
  status: RewardStatus
  payoutRequestId?: string
}

export type PlatformAllocation = {
  id: string
  recipientType: 'Jnavi取り分'
  label: string
  amountJPY: number
}

export type Allocation = UserRewardAllocation | PlatformAllocation

export type Transaction = {
  id: string
  createdAt: string // ISO
  dealId: string
  closingDate: string // YYYY-MM-DD

  productSnapshot: {
    productId: string
    name: string
    category: ProductCategory
    type: ProductType
    supplierId: string
    listPriceJPY: number
  }

  /** 成約した（売上確定を行った）コネクター */
  connectorId: string
  /** 紐づく代理店 */
  agencyId: string

  /** 顧客の売上（または粗利等） */
  saleAmountJPY: number

  /** 報酬計算対象額（今回は売上ベースを仮定） */
  baseAmountJPY: number

  /** 固定の配分率（スナップショット） */
  ratesUsed: {
    agencyRate: number
    connectorRate: number
  }

  agencyRewardJPY: number
  connectorRewardJPY: number
  jnaviShareJPY: number

  allocations: Allocation[]
}

export type PayoutStatus = '申請中' | '支払済み'

export type PayoutRequest = {
  id: string
  /** 代理店 or コネクター */
  userId: string
  requestedAt: string // ISO
  amountJPY: number
  status: PayoutStatus
  allocationIds: string[]
  processedAt?: string // ISO
}

export type SystemSettings = {
  /** 出金の最低金額 */
  minPayoutJPY: number
  /** 報酬総額率（固定）— 代理店+コネクターの報酬合計率 */
  agencyRate: number
  /** コネクター報酬率（agencyRate の内数） */
  connectorRate: number
}

export type Mail = {
  id: string
  to: string
  subject: string
  body: string
  sentAt: string // ISO
}

export type PasswordReset = {
  id: string
  userId: string
  token: string
  requestedAt: string // ISO
  expiresAt: string // ISO
}

export type OperationLog = {
  id: string
  at: string // ISO
  /** 操作者（ログイン前などは 'SYSTEM'） */
  actorUserId: string
  action: string
  detail: string
  relatedId?: string
}

export type Db = {
  schemaVersion: 4
  sessionUserId: string | null

  users: User[]
  suppliers: Supplier[]
  products: Product[]

  deals: Deal[]
  transactions: Transaction[]

  payoutRequests: PayoutRequest[]

  settings: SystemSettings

  /** デモ用：送信メールをここに保存 */
  outbox: Mail[]
  passwordResets: PasswordReset[]

  logs: OperationLog[]
}

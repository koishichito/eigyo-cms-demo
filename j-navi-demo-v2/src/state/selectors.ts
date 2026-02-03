import type { Db, Deal, Product, Transaction, User } from './types'

export function getCurrentUser(db: Db): User {
  const me = db.sessionUserId ? db.users.find((u) => u.id === db.sessionUserId) : undefined
  if (!me) throw new Error('ログインが必要です')
  return me
}

export function findUser(db: Db, userId?: string): User | undefined {
  if (!userId) return undefined
  return db.users.find((u) => u.id === userId)
}

export function findProduct(db: Db, productId?: string): Product | undefined {
  if (!productId) return undefined
  return db.products.find((p) => p.id === productId)
}

export function findDeal(db: Db, dealId?: string): Deal | undefined {
  if (!dealId) return undefined
  return db.deals.find((d) => d.id === dealId)
}

export function findTransaction(db: Db, txId?: string): Transaction | undefined {
  if (!txId) return undefined
  return db.transactions.find((t) => t.id === txId)
}

export function agencies(db: Db): User[] {
  return db.users.filter((u) => u.role === '代理店' && !!u.agency)
}

export function connectors(db: Db): User[] {
  return db.users.filter((u) => u.role === 'コネクター' && !!u.connector)
}

export function getAgencyForConnector(db: Db, connectorUserId: string): User | undefined {
  const u = db.users.find((x) => x.id === connectorUserId)
  if (!u || u.role !== 'コネクター' || !u.connector) return undefined
  return db.users.find((a) => a.id === u.connector!.agencyId)
}

export function getConnectorsForAgency(db: Db, agencyUserId: string): User[] {
  return db.users.filter((u) => u.role === 'コネクター' && u.connector?.agencyId === agencyUserId)
}

// --- Backward-compatible selector aliases ---
// Some pages import these legacy names.
export function connectorsForAgency(db: Db, agencyUserId: string): User[] {
  return getConnectorsForAgency(db, agencyUserId)
}

export function sumAgencyRewards(
  db: Db,
  agencyUserId: string,
  status?: '未確定' | '確定' | '支払済み',
): number {
  return sumUserRewards(db, agencyUserId, status)
}

export function sumConnectorRewards(
  db: Db,
  connectorUserId: string,
  status?: '未確定' | '確定' | '支払済み',
): number {
  return sumUserRewards(db, connectorUserId, status)
}

export function sumUserRewards(db: Db, userId: string, status?: '未確定' | '確定' | '支払済み'): number {
  return db.transactions
    .flatMap((t) => t.allocations)
    .filter(
      (a) =>
        a.recipientType === 'ユーザー報酬' &&
        a.userId === userId &&
        (status ? a.status === status : true),
    )
    .reduce((sum, a) => sum + a.amountJPY, 0)
}

export function sumAgencyTeamSales(db: Db, agencyUserId: string): number {
  return db.transactions
    .filter((t) => t.agencyId === agencyUserId)
    .reduce((sum, t) => sum + t.saleAmountJPY, 0)
}

export function sumConnectorSales(db: Db, connectorUserId: string): number {
  return db.transactions
    .filter((t) => t.connectorId === connectorUserId)
    .reduce((sum, t) => sum + t.saleAmountJPY, 0)
}

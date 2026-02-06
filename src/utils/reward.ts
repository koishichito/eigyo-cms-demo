import type { RewardStatus, ProductType } from '../state/types'

// 報酬ロジック（Model A: 総額内分割方式）
// - 報酬総額: base × agencyRate（例: 15%）
// - コネクター: base × connectorRate（例: 5%）← agencyRate の内数
// - 代理店: base × (agencyRate - connectorRate)（例: 10%）← 報酬総額からコネクター分を差し引いた残り
// - Jnavi取り分: 残余（= base - 報酬総額）
// ※ base は案件ごとに設定される「報酬計算対象額」。今回のデモは売上ベースで計算。

function floorJPY(x: number) {
  return Math.floor(x)
}

export function calculateModelAAmounts(args: {
  baseAmountJPY: number
  agencyRate: number
  connectorRate: number
}): {
  baseAmountJPY: number
  agencyRewardJPY: number
  connectorRewardJPY: number
  jnaviShareJPY: number
} {
  const base = Math.max(0, args.baseAmountJPY)

  if (args.connectorRate > args.agencyRate) {
    throw new Error('connectorRate は agencyRate 以下である必要があります')
  }

  const agency = floorJPY(base * (args.agencyRate - args.connectorRate))
  const connector = floorJPY(base * args.connectorRate)
  const remainder = base - (agency + connector)

  return {
    baseAmountJPY: base,
    agencyRewardJPY: agency,
    connectorRewardJPY: connector,
    jnaviShareJPY: remainder < 0 ? 0 : remainder,
  }
}

export function initialRewardStatusForProductType(productType: ProductType): RewardStatus {
  // デモ仕様：
  // - ホテル会員権は「決済完了=即時反映」を見せたいので確定扱い
  // - それ以外は運営確認ステップを残し、未確定で作成
  if (productType === 'hotel_membership') return '確定'
  return '未確定'
}

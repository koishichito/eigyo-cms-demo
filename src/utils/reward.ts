import type { RewardStatus, ProductType } from '../state/types'

// 報酬ロジック（Model A: 紹介モデル）
// - 代理店: base × 15%（固定）
// - コネクター: base × 5%（固定）
// - Jnavi取り分: 残余
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

  const agency = floorJPY(base * args.agencyRate)
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

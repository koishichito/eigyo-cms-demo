function baseUrl(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}`
}

/**
 * 取扱商品へのリンク（デモ）
 * - connectorId（コネクター）を埋め込む
 * - productId を埋め込む
 *
 * 例: /#/lp?connectorId=usr_connector_a&productId=prd_signage_glass
 */
export function buildProductReferralLink(connectorId: string, productId: string): string {
  const params = new URLSearchParams({ connectorId, productId })
  return `${baseUrl()}#/lp?${params.toString()}`
}

/**
 * コネクター登録用の招待リンク（代理店）
 * - inviteCode を埋め込む
 *
 * 例: /#/join?code=AG-A123
 */
export function buildAgencyInviteLink(inviteCode: string): string {
  const params = new URLSearchParams({ code: inviteCode })
  return `${baseUrl()}#/join?${params.toString()}`
}

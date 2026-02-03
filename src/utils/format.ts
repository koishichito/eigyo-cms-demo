export function formatJPY(value: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value)
}

/** YYYY-MM-DD（もしくはISO日時）→ YYYY-MM-DD */
export function formatDateYMD(isoOrDate: string): string {
  if (!isoOrDate) return ''
  // ISO日時の場合は先頭10桁が日付
  if (isoOrDate.includes('T')) return isoOrDate.slice(0, 10)
  return isoOrDate
}

export function formatDateJP(isoDate: string): string {
  // isoDate: YYYY-MM-DD
  const [y, m, d] = isoDate.split('-').map((v) => Number(v))
  if (!y || !m || !d) return isoDate
  return `${y}年${m}月${d}日`
}

export function formatDateTimeJP(iso: string): string {
  try {
    const dt = new Date(iso)
    const y = dt.getFullYear()
    const m = dt.getMonth() + 1
    const d = dt.getDate()
    const hh = String(dt.getHours()).padStart(2, '0')
    const mm = String(dt.getMinutes()).padStart(2, '0')
    return `${y}/${m}/${d} ${hh}:${mm}`
  } catch {
    return iso
  }
}

export function formatPercent(rate: number): string {
  return `${Math.round(rate * 100)}%`
}

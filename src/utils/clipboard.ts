export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback（古いブラウザ向け）
    try {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.top = '-1000px'
      el.style.left = '-1000px'
      document.body.appendChild(el)
      el.focus()
      el.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(el)
      return ok
    } catch {
      return false
    }
  }
}

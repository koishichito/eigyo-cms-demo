import { Menu, LogOut } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDb } from '../state/DbProvider'
import { getCurrentUser } from '../state/selectors'
import { Badge } from './Badge'

const TITLES: { prefix: string; title: string }[] = [
  { prefix: '/dashboard', title: 'ホーム' },
  { prefix: '/marketplace', title: 'カタログ' },
  { prefix: '/deals', title: '商談管理' },
  { prefix: '/network', title: '組織/チーム' },
  { prefix: '/rewards', title: '報酬/出金' },
  { prefix: '/settings', title: '設定' },
  { prefix: '/admin', title: '統合ダッシュボード' },
  { prefix: '/admin/partners', title: '組織/ユーザー' },
  { prefix: '/admin/products', title: '商品マスタ' },
  { prefix: '/admin/deals', title: '商談/取引（運営）' },
  { prefix: '/admin/payouts', title: '出金申請（運営）' },
  { prefix: '/admin/ranks', title: '報酬設定（運営）' },
  { prefix: '/admin/logs', title: '監査ログ（運営）' },
]

function titleFor(pathname: string): string {
  const hit = TITLES.find((t) => pathname.startsWith(t.prefix))
  return hit?.title ?? 'J-Navi'
}

export function TopBar(props: { mobileOpen: boolean; setMobileOpen: (open: boolean) => void }) {
  const { db, actions } = useDb()
  const me = getCurrentUser(db)
  const location = useLocation()
  const navigate = useNavigate()

  const title = titleFor(location.pathname)

  const roleBadge =
    me.role === 'J-Navi管理者' ? 'Jnavi運営' : me.role === '代理店' ? '代理店' : 'コネクター'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-3 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => props.setMobileOpen(!props.mobileOpen)}
            aria-label="メニュー"
          >
            <Menu size={18} />
          </button>
          <div>
            <div className="text-sm font-semibold text-slate-900">{title}</div>
            <div className="text-xs text-slate-500">デモ</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge tone="slate">{roleBadge}</Badge>
          <div className="hidden text-right md:block">
            <div className="text-sm font-medium text-slate-900">{me.name}</div>
            <div className="text-xs text-slate-500">{me.email}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              actions.logout()
              navigate('/login')
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <LogOut size={16} />
            ログアウト
          </button>
        </div>
      </div>
    </header>
  )
}

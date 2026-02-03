import {
  LayoutDashboard,
  ShoppingBag,
  Network,
  Wallet,
  Settings,
  X,
  ClipboardList,
  FileText,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { ElementType } from 'react'
import { NavLink } from 'react-router-dom'
import { useDb } from '../state/DbProvider'
import { getCurrentUser } from '../state/selectors'

type NavItem = {
  to: string
  label: string
  icon: ElementType
}

function navForRole(role: string): NavItem[] {
  if (role === 'J-Navi管理者') {
    return [
      { to: '/admin', label: '統合ダッシュボード', icon: LayoutDashboard },
      { to: '/admin/partners', label: '組織/ユーザー', icon: Network },
      { to: '/admin/products', label: '商品マスタ', icon: ShoppingBag },
      { to: '/admin/deals', label: '商談/取引', icon: ClipboardList },
      { to: '/admin/payouts', label: '出金申請', icon: Wallet },
      { to: '/admin/ranks', label: '報酬設定', icon: Settings },
      { to: '/admin/logs', label: '監査ログ', icon: FileText },
      { to: '/settings', label: '設定', icon: Settings },
    ]
  }


  // Agency / Connector
  return [
    { to: '/dashboard', label: 'ホーム', icon: LayoutDashboard },
    { to: '/marketplace', label: 'カタログ', icon: ShoppingBag },
    { to: '/deals', label: '商談管理', icon: ClipboardList },
    { to: '/network', label: '組織/チーム', icon: Network },
    { to: '/rewards', label: '報酬/出金', icon: Wallet },
    { to: '/settings', label: '設定', icon: Settings },
  ]
}

function NavContent(props: { onNavigate?: () => void }) {
  const { db } = useDb()
  const me = getCurrentUser(db)
  const navItems = navForRole(me.role)

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 px-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-white">
          <span className="text-sm font-semibold">J</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">J-Navi</div>
          <div className="text-[11px] text-white/70">営業マッチング & 報酬管理（デモ）</div>
        </div>
      </div>

      <nav className="flex-1 px-2 pb-3">
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => props.onNavigate?.()}
              className={({ isActive }) =>
                clsx(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition',
                  isActive ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <Icon size={18} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <div className="text-xs text-white/70">© {new Date().getFullYear()} J-Navi</div>
      </div>
    </div>
  )
}

export function Sidebar(props: { mobileOpen: boolean; setMobileOpen: (open: boolean) => void }) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden h-screen w-64 shrink-0 bg-[var(--jnavi-navy)] md:block">
        <NavContent />
      </aside>

      {/* Mobile */}
      {props.mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" aria-label="メニュー">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => props.setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-[min(18rem,85vw)] bg-[var(--jnavi-navy)] shadow-xl">
            <div className="flex items-center justify-end px-3 pt-3">
              <button
                type="button"
                onClick={() => props.setMobileOpen(false)}
                className="rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label="閉じる"
              >
                <X size={18} />
              </button>
            </div>
            <NavContent onNavigate={() => props.setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}
    </>
  )
}

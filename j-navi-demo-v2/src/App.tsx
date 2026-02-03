import { createHashRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { DbProvider, useDb, getRoleHomePath, getSessionUser } from './state/DbProvider'
import { AppShell } from './layout/AppShell'

// Public pages
import LoginPage from './pages/Login'
import ForgotPasswordPage from './pages/ForgotPassword'
import ResetPasswordPage from './pages/ResetPassword'
import OutboxPage from './pages/Outbox'
import JoinPage from './pages/Join'
import ReferralLandingPage from './pages/ReferralLanding'

// Agency / Connector pages
import DashboardPage from './pages/Dashboard'
import MarketplacePage from './pages/Marketplace'
import DealsPage from './pages/Deals'
import RewardsPage from './pages/Rewards'
import NetworkPage from './pages/Network'
import SettingsPage from './pages/Settings'

// Admin pages
import AdminDashboardPage from './pages/admin/AdminDashboard'
import AdminPartnersPage from './pages/admin/AdminPartners'
import AdminProductsPage from './pages/admin/AdminProducts'
import AdminDealsPage from './pages/admin/AdminDeals'
import AdminPayoutsPage from './pages/admin/AdminPayouts'
import AdminRanksPage from './pages/admin/AdminRanks'
import AdminLogsPage from './pages/admin/AdminLogs'

function RequireAuth() {
  const { db } = useDb()
  const u = getSessionUser(db)
  if (!u) return <Navigate to="/login" replace />
  return <Outlet />
}

function RequireRole(props: { roles: Array<'代理店' | 'コネクター' | 'J-Navi管理者'> }) {
  const { db } = useDb()
  const u = getSessionUser(db)
  if (!u) return <Navigate to="/login" replace />
  if (!props.roles.includes(u.role as any)) return <Navigate to={getRoleHomePath(u)} replace />
  return <Outlet />
}

const router = createHashRouter([
  {
    path: '/',
    element: (
      <DbProvider>
        <Outlet />
      </DbProvider>
    ),
    children: [
      // Public
      { index: true, element: <Navigate to="/login" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'join', element: <JoinPage /> },
      { path: 'forgot', element: <ForgotPasswordPage /> },
      { path: 'reset', element: <ResetPasswordPage /> },
      { path: 'outbox', element: <OutboxPage /> },
      { path: 'lp', element: <ReferralLandingPage /> },

      // Protected
      {
        element: <RequireAuth />,
        children: [
          {
            // NOTE: Public pages (login/join/...) must NOT render the sidebar/topbar.
            // Otherwise the app throws "ログインが必要です" and shows a blank screen.
            element: <AppShell />,
            children: [
              // Common (all authenticated roles)
              { path: 'settings', element: <SettingsPage /> },

              // Agency / Connector
              {
                element: <RequireRole roles={['代理店', 'コネクター']} />,
                children: [
                  { path: 'dashboard', element: <DashboardPage /> },
                  { path: 'marketplace', element: <MarketplacePage /> },
                  { path: 'deals', element: <DealsPage /> },
                  { path: 'rewards', element: <RewardsPage /> },
                  { path: 'network', element: <NetworkPage /> },
                ],
              },

              // Admin
              {
                element: <RequireRole roles={['J-Navi管理者']} />,
                children: [
                  { path: 'admin', element: <AdminDashboardPage /> },
                  { path: 'admin/partners', element: <AdminPartnersPage /> },
                  { path: 'admin/products', element: <AdminProductsPage /> },
                  { path: 'admin/deals', element: <AdminDealsPage /> },
                  { path: 'admin/payouts', element: <AdminPayoutsPage /> },
                  { path: 'admin/ranks', element: <AdminRanksPage /> },
                  { path: 'admin/logs', element: <AdminLogsPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}

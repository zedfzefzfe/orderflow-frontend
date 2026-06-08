import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Sparkles, Package, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface NavItemProps {
  to: string
  icon: React.ElementType
  label: string
  active: boolean
}

function NavItem({ to, icon: Icon, label, active }: NavItemProps) {
  return (
    <Link
      to={to}
      className={`group relative flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
        active
          ? 'bg-emerald-50 text-emerald-600'
          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-50">
        {label}
      </span>
    </Link>
  )
}

export default function Sidebar() {
  const location = useLocation()
  const { user, logout } = useAuth()

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : '??'

  return (
    <aside className="fixed left-0 top-0 h-full w-16 bg-white border-r border-gray-200 flex flex-col items-center py-4 z-30">
      {/* Logo */}
      <Link
        to="/dashboard"
        className="mb-6 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 transition-opacity hover:opacity-90"
      >
        <Package className="h-5 w-5 text-white" />
      </Link>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col items-center gap-1.5">
        <NavItem
          to="/dashboard"
          icon={LayoutDashboard}
          label="Commandes"
          active={location.pathname === '/dashboard'}
        />
        <NavItem
          to="/analytics"
          icon={TrendingUp}
          label="Analytics"
          active={location.pathname === '/analytics'}
        />
        <NavItem
          to="/agent"
          icon={Sparkles}
          label="Votre Agent"
          active={location.pathname === '/agent'}
        />
      </nav>

      {/* Bottom: settings + avatar + logout */}
      <div className="flex flex-col items-center gap-2">
        <NavItem
          to="/settings"
          icon={Settings}
          label="Paramètres"
          active={location.pathname === '/settings'}
        />
        <div className="group relative flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700 cursor-default">
          {initials}
          <span className="pointer-events-none absolute left-full ml-3 max-w-[160px] truncate whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-50">
            {user?.email}
          </span>
        </div>
        <button
          onClick={logout}
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
        >
          <LogOut className="h-4 w-4" />
          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-50">
            Se déconnecter
          </span>
        </button>
      </div>
    </aside>
  )
}

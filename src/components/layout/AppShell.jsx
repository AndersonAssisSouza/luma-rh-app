import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'

const ROLE_LABELS = {
  manager_global: 'Manager Global',
  master: 'Administrador',
  rh: 'RH',
  gestor: 'Gestor',
  colaborador: 'Colaborador',
}

function LumaLogo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="#9b66f4"/>
      <path d="M7 23 L13 9 L16 15.5 L19 9 L25 23" stroke="#ffd000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const NAV_RH = [
  { to: '/dashboard',      icon: '⬡', label: 'Dashboard' },
  { to: '/colaboradores',  icon: '◈', label: 'Colaboradores' },
  { to: '/alertas',        icon: '◉', label: 'Alertas', badge: true },
  { to: '/ferias',         icon: '◎', label: 'Férias' },
  { to: '/ferias/aprovar', icon: '✓', label: 'Aprovar Férias' },
  { to: '/exames',         icon: '◫', label: 'Exames ASO' },
  { to: '/contratos',      icon: '◧', label: 'Contratos' },
  { to: '/analytics',      icon: '◈', label: 'People Analytics' },
  { to: '/dre',            icon: '▦', label: 'DRE' },
  { to: '/usuarios',       icon: '◎', label: 'Usuários' },
]

const NAV_COLAB = [
  { to: '/dashboard',       icon: '⬡', label: 'Início' },
  { to: '/ferias/solicitar',icon: '◎', label: 'Minhas Férias' },
]

const BOTTOM_NAV = [
  { to: '/configuracoes', icon: '⚙', label: 'Configurações' },
]

export default function AppShell() {
  const { profile, tenant, signOut } = useAuthStore()
  const [collapsed, setCollapsed] = useState(false)
  const [alertCount] = useState(null)
  const navigate = useNavigate()

  const isColab = profile?.role === 'colaborador'
  const NAV = isColab ? NAV_COLAB : NAV_RH

  return (
    <div className="flex min-h-screen bg-luma-ink">
      {/* Sidebar */}
      <aside className={`
        flex flex-col shrink-0 border-r border-[var(--luma-border)]
        bg-luma-ink2 transition-all duration-300 ease-in-out
        ${collapsed ? 'w-16' : 'w-56'}
      `}>
        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-[var(--luma-border)] ${collapsed ? 'justify-center' : ''}`}>
          <LumaLogo />
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold text-white text-sm tracking-wide">LUMA RH</div>
              {tenant && (
                <div className="text-[10px] text-gray-500 truncate">{tenant.nome}</div>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon, label, badge }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
              }
            >
              <span className="text-base leading-none shrink-0" title={collapsed ? label : undefined}>
                {icon}
              </span>
              {!collapsed && (
                <span className="flex-1 truncate">{label}</span>
              )}
              {!collapsed && badge && alertCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {alertCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="py-3 px-2 border-t border-[var(--luma-border)] space-y-0.5">
          {BOTTOM_NAV.map(({ to, icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`
              }
            >
              <span className="text-base leading-none shrink-0">{icon}</span>
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}

          {/* User */}
          {!collapsed && profile && (
            <div className="mt-2 px-3 py-2.5 rounded-lg border border-[var(--luma-border)] bg-luma-dark1">
              <div className="text-xs font-medium text-gray-200 truncate">{profile.nome}</div>
              <div className="text-[10px] text-gray-500 mt-0.5">{ROLE_LABELS[profile.role] ?? profile.role}</div>
              <button
                onClick={signOut}
                className="mt-2 text-[10px] text-gray-500 hover:text-red-400 transition-colors"
              >
                Sair
              </button>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`nav-item w-full ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="text-sm">{collapsed ? '→' : '←'}</span>
            {!collapsed && <span className="text-xs">Recolher menu</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}

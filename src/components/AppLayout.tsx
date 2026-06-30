import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  CalendarDays,
  Users,
  LogOut,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ThemeSwitcher } from './ThemeSwitcher'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard size={18} strokeWidth={1.5} />,
    roles: ['owner', 'manager', 'receptionist', 'super_admin'],
  },
  {
    to: '/properties',
    label: 'Properties',
    icon: <Building2 size={18} strokeWidth={1.5} />,
    roles: ['owner', 'manager', 'receptionist', 'super_admin'],
  },
  {
    to: '/bookings',
    label: 'Bookings',
    icon: <CalendarDays size={18} strokeWidth={1.5} />,
    roles: ['owner', 'manager', 'receptionist', 'super_admin'],
  },
  {
    to: '/assistant',
    label: 'AI Assistant',
    icon: <Sparkles size={18} strokeWidth={1.5} />,
    roles: ['owner', 'manager', 'receptionist', 'super_admin'],
  },
  {
    to: '/staff',
    label: 'Staff',
    icon: <Users size={18} strokeWidth={1.5} />,
    roles: ['owner', 'super_admin'],
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: <Settings size={18} strokeWidth={1.5} />,
    roles: ['owner', 'manager', 'receptionist', 'super_admin'],
  },
]

interface Props {
  children: React.ReactNode
}

export function AppLayout({ children }: Props) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter(
    (item) => user && item.roles.includes(user.role)
  )

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebarWidth = collapsed ? '4rem' : '14rem'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          zIndex: 50,
          width: mobileOpen ? '14rem' : sidebarWidth,
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          borderRight: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.25s ease-out',
        }}
      >
        {/* Wordmark + collapse toggle */}
        <div style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem 1rem',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: '3.75rem',
        }}>
          {!collapsed && (
            <span style={{ fontSize: '1.1rem', fontWeight: 300, letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
              Nex<span style={{ color: 'var(--primary)' }}>Bookings</span>
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '1.75rem', height: '1.75rem',
              borderRadius: '0.375rem',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <ChevronRight size={14} strokeWidth={1.5} />
              : <ChevronLeft size={14} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: collapsed ? '0.75rem 0' : '0.75rem 1rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '0.125rem 0.5rem',
                borderRadius: '0.5rem',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                background: isActive
                  ? 'color-mix(in oklab, var(--primary) 12%, transparent)'
                  : 'transparent',
                borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                textDecoration: 'none',
                fontSize: '0.9375rem',
                fontWeight: isActive ? 500 : 400,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              })}
            >
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User info + sign out */}
        <div style={{
          padding: collapsed ? '1rem 0' : '1rem',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          alignItems: collapsed ? 'center' : 'stretch',
        }}>
          {!collapsed && user && (
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name || user.email}
              </p>
              <p className="mono-accent" style={{ color: 'var(--accent)', marginTop: '0.125rem' }}>
                {user.role}
              </p>
            </div>
          )}
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              justifyContent: collapsed ? 'center' : 'flex-start',
              color: 'var(--text-secondary)',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              padding: '0.375rem 0',
              width: '100%',
            }}
          >
            <LogOut size={16} strokeWidth={1.5} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div style={{
        flex: 1,
        marginLeft: sidebarWidth,
        transition: 'margin-left 0.25s ease-out',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}>
        {/* Topbar */}
        <header style={{
          height: '3.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          borderBottom: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}>
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>

          <ThemeSwitcher />
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: '72rem', width: '100%', margin: '0 auto' }}>
          {children}
        </main>

        {/* Footer */}
        <footer style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--glass-border)',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
        }}>
          Built by{' '}
          <a href="https://nex-chi-six.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
            Jackson Mwaniki Munene
          </a>
          {' '}— nex-chi-six.vercel.app
        </footer>
      </div>
    </div>
  )
}
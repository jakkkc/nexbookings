import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, CalendarDays, Users,
  LogOut, ChevronLeft, ChevronRight, Settings,
  Sparkles, MoreHorizontal, X, BarChart2,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { ThemeSwitcher } from './ThemeSwitcher'
import { WelcomeTour } from './WelcomeTour'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
  roles: string[]
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} strokeWidth={1.5} />, roles: ['owner', 'manager', 'receptionist', 'super_admin'] },
  { to: '/properties', label: 'Properties', icon: <Building2 size={20} strokeWidth={1.5} />, roles: ['owner', 'manager', 'receptionist', 'super_admin'] },
  { to: '/bookings', label: 'Bookings', icon: <CalendarDays size={20} strokeWidth={1.5} />, roles: ['owner', 'manager', 'receptionist', 'super_admin'] },
  { to: '/reports', label: 'Reports', icon: <BarChart2 size={20} strokeWidth={1.5} />, roles: ['owner', 'manager', 'super_admin'] },
  { to: '/assistant', label: 'AI', icon: <Sparkles size={20} strokeWidth={1.5} />, roles: ['owner', 'manager', 'receptionist', 'super_admin'] },
  { to: '/staff', label: 'Staff', icon: <Users size={20} strokeWidth={1.5} />, roles: ['owner', 'super_admin'] },
  { to: '/settings', label: 'Settings', icon: <Settings size={20} strokeWidth={1.5} />, roles: ['owner', 'manager', 'receptionist', 'super_admin'] },
]

// Bottom bar shows max 4 primary items + "More" button
const BOTTOM_PRIMARY = ['/dashboard', '/bookings', '/assistant', '/properties']

interface Props { children: React.ReactNode }

export function AppLayout({ children }: Props) {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter(item => user && item.roles.includes(user.role))
  const bottomItems = visibleItems.filter(item => BOTTOM_PRIMARY.includes(item.to))
  const moreItems = visibleItems.filter(item => !BOTTOM_PRIMARY.includes(item.to))

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sidebarWidth = collapsed ? '4rem' : '14rem'

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <WelcomeTour />

      {/* ── Desktop sidebar (hidden on mobile) ───────────────── */}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50,
        width: sidebarWidth,
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--glass-border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s ease-out',
      }}
        className="desktop-sidebar"
      >
        {/* Wordmark + collapse */}
        <div style={{
          padding: collapsed ? '1.25rem 0' : '1.25rem 1rem',
          borderBottom: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'center',
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
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem',
              background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            {collapsed ? <ChevronRight size={14} strokeWidth={1.5} /> : <ChevronLeft size={14} strokeWidth={1.5} />}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
          {visibleItems.map(item => (
            <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: collapsed ? '0.75rem 0' : '0.75rem 1rem',
              justifyContent: collapsed ? 'center' : 'flex-start',
              margin: '0.125rem 0.5rem', borderRadius: '0.5rem',
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
              background: isActive ? 'color-mix(in oklab, var(--primary) 12%, transparent)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
              textDecoration: 'none', fontSize: '0.9375rem',
              fontWeight: isActive ? 500 : 400, transition: 'all 0.15s',
              whiteSpace: 'nowrap', overflow: 'hidden',
            })}>
              {item.icon}
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User + sign out */}
        <div style={{
          padding: collapsed ? '1rem 0' : '1rem',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          alignItems: collapsed ? 'center' : 'stretch',
        }}>
          {!collapsed && user && (
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.full_name || user.email}
              </p>
              <p className="mono-accent" style={{ color: 'var(--accent)', marginTop: '0.125rem' }}>{user.role}</p>
            </div>
          )}
          <button onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--text-secondary)', background: 'none',
            cursor: 'pointer', fontSize: '0.875rem', padding: '0.375rem 0', width: '100%',
          }}>
            <LogOut size={16} strokeWidth={1.5} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <div style={{
        flex: 1,
        marginLeft: sidebarWidth,
        transition: 'margin-left 0.25s ease-out',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}
        className="desktop-main"
      >
        {/* Topbar */}
        <header style={{
          height: '3.75rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 1rem',
          borderBottom: '1px solid var(--glass-border)',
          background: 'var(--glass-bg)', backdropFilter: 'blur(20px)',
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 300, letterSpacing: '0.06em' }}
            className="mobile-wordmark">
            Nex<span style={{ color: 'var(--primary)' }}>Bookings</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <ThemeSwitcher />
            <button onClick={handleSignOut}
              className="desktop-signout"
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
              <LogOut size={15} strokeWidth={1.5} />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{
          flex: 1,
          padding: '1.25rem 1rem',
          maxWidth: '72rem', width: '100%', margin: '0 auto',
          paddingBottom: '5rem', // space for mobile bottom bar
        }}
          className="main-content"
        >
          {children}
        </main>

        {/* Footer — desktop only */}
        <footer style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--glass-border)',
          textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)',
        }}
          className="desktop-footer"
        >
          Built by{' '}
          <a href="https://nex-chi-six.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
            Jackson Mwaniki Munene
          </a>
          {' '}— nex-chi-six.vercel.app
        </footer>
      </div>

      {/* ── Mobile bottom navigation bar ─────────────────────── */}
      <nav
        className="mobile-bottom-nav"
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: 'var(--glass-bg)', backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex', alignItems: 'stretch',
          height: '4rem',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {bottomItems.map(item => (
          <NavLink key={item.to} to={item.to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
            color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
            textDecoration: 'none', fontSize: '0.625rem', fontWeight: 500,
            letterSpacing: '0.04em', textTransform: 'uppercase',
            background: isActive ? 'color-mix(in oklab, var(--primary) 8%, transparent)' : 'transparent',
            borderTop: isActive ? '2px solid var(--primary)' : '2px solid transparent',
            transition: 'all 0.15s',
          })}>
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}

        {/* More button */}
        {moreItems.length > 0 && (
          <button
            onClick={() => setMoreOpen(true)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
              color: 'var(--text-secondary)', background: 'none',
              fontSize: '0.625rem', fontWeight: 500,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              borderTop: '2px solid transparent', cursor: 'pointer',
            }}
          >
            <MoreHorizontal size={20} strokeWidth={1.5} />
            <span>More</span>
          </button>
        )}
      </nav>

      {/* ── More drawer (mobile) ──────────────────────────────── */}
      {moreOpen && (
        <>
          <div
            onClick={() => setMoreOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
          />
          <div style={{
            position: 'fixed', bottom: '4rem', left: 0, right: 0, zIndex: 70,
            background: 'var(--glass-bg)', backdropFilter: 'blur(24px)',
            borderTop: '1px solid var(--glass-border)',
            borderRadius: '1rem 1rem 0 0',
            padding: '1.25rem 1rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <p className="mono-accent" style={{ color: 'var(--primary)' }}>More</p>
              <button onClick={() => setMoreOpen(false)} style={{ background: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {moreItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.875rem 1rem', borderRadius: '0.5rem',
                  color: isActive ? 'var(--primary)' : 'var(--text)',
                  background: isActive ? 'color-mix(in oklab, var(--primary) 10%, transparent)' : 'transparent',
                  textDecoration: 'none', fontSize: '1rem', fontWeight: isActive ? 500 : 400,
                  marginBottom: '0.25rem',
                })}
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}

            <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
              {user && (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', paddingLeft: '1rem' }}>
                  {user.full_name || user.email} · <span className="mono-accent" style={{ color: 'var(--accent)' }}>{user.role}</span>
                </p>
              )}
              <button
                onClick={handleSignOut}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.875rem 1rem', borderRadius: '0.5rem',
                  color: '#ef4444', background: 'color-mix(in oklab, #ef4444 8%, transparent)',
                  width: '100%', cursor: 'pointer', fontSize: '1rem',
                }}
              >
                <LogOut size={20} strokeWidth={1.5} />
                Sign out
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        /* Desktop: show sidebar, hide mobile nav */
        @media (min-width: 768px) {
          .desktop-sidebar { display: flex !important; }
          .desktop-main { margin-left: ${sidebarWidth} !important; }
          .mobile-bottom-nav { display: none !important; }
          .mobile-wordmark { display: none !important; }
          .desktop-signout { display: flex !important; }
          .desktop-footer { display: block !important; }
          .main-content { padding: 2rem 1.5rem 2rem !important; }
        }
        /* Mobile: hide sidebar, show bottom nav */
        @media (max-width: 767px) {
          .desktop-sidebar { display: none !important; }
          .desktop-main { margin-left: 0 !important; }
          .desktop-signout { display: none !important; }
          .desktop-footer { display: none !important; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
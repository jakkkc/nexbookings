import { useNavigate, Navigate } from 'react-router-dom'
import {
  Building2, BedDouble, CalendarDays, CreditCard,
  FileText, ArrowRight, Check,
} from 'lucide-react'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { useAuth } from '../contexts/AuthContext'

const FEATURES = [
  {
    icon: <Building2 size={18} strokeWidth={1.5} />,
    title: 'Multi-property management',
    desc: 'Run multiple lodges, cottages, or guesthouses from one account. Each property is independently branded.',
  },
  {
    icon: <BedDouble size={18} strokeWidth={1.5} />,
    title: 'Flexible room types',
    desc: 'Define room types with full pricing matrices — single, double, extra pax, across BB, HB, and FB meal plans.',
  },
  {
    icon: <CalendarDays size={18} strokeWidth={1.5} />,
    title: 'Booking & availability',
    desc: 'Real-time availability checks prevent double bookings. Create, confirm, check in, and check out in seconds.',
  },
  {
    icon: <CreditCard size={18} strokeWidth={1.5} />,
    title: 'Payment tracking',
    desc: 'Record deposits and balances manually. Attach M-Pesa screenshots or bank slips. Track discounts and upsells.',
  },
  {
    icon: <FileText size={18} strokeWidth={1.5} />,
    title: 'Printable documents',
    desc: 'Generate branded booking confirmations, invoices, and receipts — one click, ready to share.',
  },
  {
    icon: <Check size={18} strokeWidth={1.5} />,
    title: 'Role-based access',
    desc: 'Owners, managers, and receptionists each see and do exactly what they should. Nothing more.',
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const { session, loading } = useAuth()

  // Already logged in — go straight to dashboard
  if (!loading && session) return <Navigate to="/dashboard" replace />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 2rem', borderBottom: '1px solid var(--glass-border)' }}>
        <span style={{ fontSize: '1.1rem', fontWeight: 300, letterSpacing: '0.06em' }}>
          Nex<span style={{ color: 'var(--primary)' }}>Bookings</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <ThemeSwitcher />
          <button
            onClick={() => navigate('/login')}
            style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, fontSize: '0.9375rem', cursor: 'pointer', border: 'none' }}
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5rem 2rem 4rem', textAlign: 'center', maxWidth: '48rem', margin: '0 auto', width: '100%' }}>
        <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1.25rem' }}>
          Property & booking management
        </p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)', fontWeight: 300, lineHeight: 1.15, letterSpacing: '-0.02em', marginBottom: '1.5rem' }}>
          Run your lodge.<br />
          <span style={{ color: 'var(--primary)' }}>Not your spreadsheets.</span>
        </h1>
        <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '32rem' }}>
          NexBookings is built for Kenyan lodges, cottages, and guesthouses. Manage properties, rooms, bookings, and payments — all in one place.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => navigate('/login')}
            className="glow-border"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 2rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', border: 'none' }}
          >
            Get started free <ArrowRight size={16} strokeWidth={1.5} />
          </button>
          <button
            onClick={() => navigate('/login')}
            style={{ padding: '0.875rem 2rem', borderRadius: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)', fontWeight: 500, fontSize: '1rem', cursor: 'pointer' }}
          >
            Sign in
          </button>
        </div>
      </section>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--glass-border)', maxWidth: '64rem', margin: '0 auto', width: '100%' }} />

      {/* Features */}
      <section style={{ padding: '4rem 2rem', maxWidth: '64rem', margin: '0 auto', width: '100%' }}>
        <p className="mono-accent" style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', textAlign: 'center' }}>
          Everything you need
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(17rem, 1fr))', gap: '1px', background: 'var(--glass-border)' }}>
          {FEATURES.map((f, i) => (
            <div
              key={i}
              style={{ padding: '1.75rem', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div style={{ color: 'var(--primary)' }}>{f.icon}</div>
              <p style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{f.title}</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA strip */}
      <section style={{ padding: '3.5rem 2rem', textAlign: 'center', borderTop: '1px solid var(--glass-border)' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 300, marginBottom: '1rem' }}>
          Ready to get organised?
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem' }}>
          Create your account in under a minute. No credit card required.
        </p>
        <button
          onClick={() => navigate('/login')}
          className="glow-border"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.875rem 2.5rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', border: 'none' }}
        >
          Create free account <ArrowRight size={16} strokeWidth={1.5} />
        </button>
      </section>

      {/* Footer */}
      <footer style={{ padding: '1.5rem 2rem', borderTop: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        <span>© {new Date().getFullYear()} NexBookings</span>
        <span>
          Built by{' '}
          <a href="https://nex-chi-six.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
            Jackson Mwaniki Munene
          </a>
          {' '}— nex-chi-six.vercel.app
        </span>
      </footer>
    </div>
  )
}
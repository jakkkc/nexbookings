import { useState, useEffect } from 'react'
import {
  X, Building2, BedDouble, CalendarDays, CreditCard,
  Sparkles, Users, FileText, Settings,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const TOUR_SEEN_KEY_PREFIX = 'nexbookings-tour-seen-'

interface TourItem {
  icon: React.ReactNode
  title: string
  desc: string
}

const OWNER_ITEMS: TourItem[] = [
  { icon: <Building2 size={18} strokeWidth={1.5} />, title: 'Properties', desc: 'Add each lodge, cottage, or guesthouse you manage. Each one gets its own branding, room types, and rooms.' },
  { icon: <BedDouble size={18} strokeWidth={1.5} />, title: 'Room types & rooms', desc: 'Inside a property, define room types with full pricing (single/double/extra pax × BB/HB/FB), then add physical rooms under each type.' },
  { icon: <CalendarDays size={18} strokeWidth={1.5} />, title: 'Bookings', desc: 'Create bookings with live availability checking, track status from pending through checked out, and never double-book a room.' },
  { icon: <CreditCard size={18} strokeWidth={1.5} />, title: 'Payments & documents', desc: 'Record deposits and balances with discounts, attach M-Pesa slips, and print branded confirmations, invoices, and receipts.' },
  { icon: <Sparkles size={18} strokeWidth={1.5} />, title: 'AI Assistant', desc: 'Paste a guest inquiry from WhatsApp — in English, Swahili, or Sheng — and get an instant availability check with a ready-to-send reply.' },
  { icon: <Users size={18} strokeWidth={1.5} />, title: 'Staff', desc: 'Invite managers and receptionists, assign them to specific properties, and control exactly what they can see and do.' },
]

const STAFF_ITEMS: TourItem[] = [
  { icon: <CalendarDays size={18} strokeWidth={1.5} />, title: 'Bookings', desc: 'Create and manage bookings for the properties you\'re assigned to. Check availability, update status, and record payments.' },
  { icon: <CreditCard size={18} strokeWidth={1.5} />, title: 'Payments', desc: 'Record deposits and balances on any booking. Attach M-Pesa screenshots or bank slips as proof.' },
  { icon: <FileText size={18} strokeWidth={1.5} />, title: 'Printable documents', desc: 'Open any booking and print a confirmation, invoice, or receipt for the guest.' },
  { icon: <Sparkles size={18} strokeWidth={1.5} />, title: 'AI Assistant', desc: 'Paste a guest inquiry and get an instant availability check plus a ready-to-send reply — in English, Swahili, or Sheng.' },
  { icon: <Settings size={18} strokeWidth={1.5} />, title: 'Settings', desc: 'Change your password anytime from the Settings page.' },
]

export function WelcomeTour() {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!user) return
    const key = TOUR_SEEN_KEY_PREFIX + user.id
    const seen = localStorage.getItem(key)
    if (!seen) setVisible(true)
  }, [user])

  function dismiss() {
    if (user) localStorage.setItem(TOUR_SEEN_KEY_PREFIX + user.id, 'true')
    setVisible(false)
  }

  if (!visible || !user) return null

  const isOwner = user.role === 'owner' || user.role === 'super_admin'
  const items = isOwner ? OWNER_ITEMS : STAFF_ITEMS

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass-card"
        style={{
          maxWidth: '32rem', width: '100%',
          maxHeight: '85vh', overflowY: 'auto',
          padding: '2rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <div>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>
              Welcome
            </p>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 300 }}>
              Hi{user.full_name ? `, ${user.full_name.split(' ')[0]}` : ''} — here's a quick tour
            </h2>
          </div>
          <button
            onClick={dismiss}
            style={{ padding: '0.375rem', borderRadius: '0.375rem', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}
            aria-label="Close"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: '1.75rem', lineHeight: 1.6 }}>
          {isOwner
            ? "You're set up as an owner. Here's what each part of NexBookings does:"
            : `You've been added as a ${user.role}. Here's what you can do in NexBookings:`}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.875rem' }}>
              <div style={{
                width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', flexShrink: 0,
                background: 'color-mix(in oklab, var(--primary) 12%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary)',
              }}>
                {item.icon}
              </div>
              <div>
                <p style={{ fontWeight: 500, fontSize: '0.9375rem', marginBottom: '0.125rem' }}>{item.title}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={dismiss}
          className="glow-border"
          style={{
            width: '100%', padding: '0.75rem', borderRadius: '0.5rem',
            background: 'var(--primary)', color: 'var(--bg)',
            fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer',
          }}
        >
          Got it, let's go
        </button>
      </div>
    </div>
  )
}
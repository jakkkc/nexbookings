import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, BedDouble, CalendarDays, ChevronRight, Check, Circle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'
import type { Database } from '../types/database'

type Property = Database['public']['Tables']['properties']['Row']

const CHECKLIST_KEY = 'nexbookings-setup-dismissed'

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [properties, setProperties] = useState<Property[]>([])
  const [roomCount, setRoomCount] = useState(0)
  const [roomTypeCount, setRoomTypeCount] = useState(0)
  const [bookingCount, setBookingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem(CHECKLIST_KEY) === 'true'
  )

  const isOwner = user?.role === 'owner' || user?.role === 'super_admin'

  useEffect(() => {
    async function fetchSummary() {
      const [propRes, roomRes, rtRes, bookRes] = await Promise.all([
        supabase.from('properties').select('*').order('created_at'),
        supabase.from('rooms').select('id', { count: 'exact', head: true }),
        supabase.from('room_types').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('id', { count: 'exact', head: true }),
      ])
      if (!propRes.error) setProperties(propRes.data || [])
      if (!roomRes.error) setRoomCount(roomRes.count || 0)
      if (!rtRes.error) setRoomTypeCount(rtRes.count || 0)
      if (!bookRes.error) setBookingCount(bookRes.count || 0)
      setLoading(false)
    }
    fetchSummary()
  }, [])

  function dismissChecklist() {
    localStorage.setItem(CHECKLIST_KEY, 'true')
    setChecklistDismissed(true)
  }

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  // Setup checklist steps
  const steps = [
    { label: 'Create your account', done: true, path: null },
    { label: 'Add your first property', done: properties.length > 0, path: '/properties' },
    { label: 'Add room types with pricing', done: roomTypeCount > 0, path: properties[0] ? `/properties/${properties[0].id}` : '/properties' },
    { label: 'Add rooms', done: roomCount > 0, path: properties[0] ? `/properties/${properties[0].id}` : '/properties' },
    { label: 'Create your first booking', done: bookingCount > 0, path: '/bookings/new' },
  ]
  const allDone = steps.every(s => s.done)
  const showChecklist = isOwner && !checklistDismissed && !allDone && !loading

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>Dashboard</p>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>
          {greeting()}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h2>
      </div>

      {/* Setup checklist */}
      {showChecklist && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '2rem', borderLeft: '3px solid var(--primary)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <p style={{ fontWeight: 500, fontSize: '1rem' }}>Get set up</p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Complete these steps to start taking bookings.
              </p>
            </div>
            <button
              onClick={dismissChecklist}
              style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '0.25rem', border: '1px solid var(--glass-border)' }}
            >
              Dismiss
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {steps.map((step, i) => (
              <div
                key={i}
                onClick={() => !step.done && step.path && navigate(step.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.875rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  background: step.done ? 'color-mix(in oklab, var(--primary) 6%, transparent)' : 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  cursor: !step.done && step.path ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{
                  width: '1.375rem', height: '1.375rem', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step.done ? 'var(--primary)' : 'transparent',
                  border: step.done ? 'none' : '1.5px solid var(--glass-border)',
                }}>
                  {step.done
                    ? <Check size={12} strokeWidth={2.5} style={{ color: 'var(--bg)' }} />
                    : <Circle size={8} strokeWidth={0} style={{ fill: 'var(--text-secondary)', opacity: 0.3 }} />
                  }
                </div>
                <span style={{
                  fontSize: '0.9375rem',
                  color: step.done ? 'var(--text-secondary)' : 'var(--text)',
                  textDecoration: step.done ? 'line-through' : 'none',
                  flex: 1,
                }}>
                  {step.label}
                </span>
                {!step.done && step.path && (
                  <ChevronRight size={15} strokeWidth={1.5} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard icon={<Building2 size={20} strokeWidth={1.5} />} label="Properties" value={loading ? '—' : String(properties.length)} onClick={() => navigate('/properties')} />
        <StatCard icon={<BedDouble size={20} strokeWidth={1.5} />} label="Rooms" value={loading ? '—' : String(roomCount)} onClick={() => navigate('/properties')} />
        <StatCard icon={<CalendarDays size={20} strokeWidth={1.5} />} label="Bookings" value={loading ? '—' : String(bookingCount)} onClick={() => navigate('/bookings')} />
      </div>

      {/* Recent properties */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <p className="mono-accent" style={{ color: 'var(--text-secondary)' }}>Your properties</p>
          <button onClick={() => navigate('/properties')} style={{ fontSize: '0.875rem', color: 'var(--primary)', background: 'none', cursor: 'pointer' }}>
            View all
          </button>
        </div>

        {!loading && properties.length === 0 && (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            No properties yet.{' '}
            {isOwner && (
              <button onClick={() => navigate('/properties')} style={{ color: 'var(--primary)', background: 'none', cursor: 'pointer' }}>
                Add your first property →
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {properties.slice(0, 5).map(p => (
            <button
              key={p.id}
              onClick={() => navigate(`/properties/${p.id}`)}
              className="glass-card"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', cursor: 'pointer', width: '100%', textAlign: 'left' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} style={{ width: '2rem', height: '2rem', borderRadius: '0.375rem', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '2rem', height: '2rem', borderRadius: '0.375rem', background: 'color-mix(in oklab, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Building2 size={14} strokeWidth={1.5} style={{ color: 'var(--primary)' }} />
                  </div>
                )}
                <span style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{p.name}</span>
              </div>
              <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  )
}

function StatCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  return (
    <div className="glass-card" onClick={onClick} style={{ padding: '1.25rem', cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ color: 'var(--primary)' }}>{icon}</div>
      <p style={{ fontSize: '1.75rem', fontWeight: 300, lineHeight: 1 }}>{value}</p>
      <p className="mono-accent" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  )
}
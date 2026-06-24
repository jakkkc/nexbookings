import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, BedDouble, CalendarDays, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'
import type { Database } from '../types/database'

type Property = Database['public']['Tables']['properties']['Row']

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [properties, setProperties] = useState<Property[]>([])
  const [roomCount, setRoomCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchSummary() {
      const [propRes, roomRes] = await Promise.all([
        supabase.from('properties').select('*').order('created_at', { ascending: true }),
        supabase.from('rooms').select('id', { count: 'exact', head: true }),
      ])
      if (!propRes.error) setProperties(propRes.data || [])
      if (!roomRes.error) setRoomCount(roomRes.count || 0)
      setLoading(false)
    }
    fetchSummary()
  }, [])

  const greeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>Dashboard</p>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>
          {greeting()}{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''}
        </h2>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard
          icon={<Building2 size={20} strokeWidth={1.5} />}
          label="Properties"
          value={loading ? '—' : String(properties.length)}
          onClick={() => navigate('/properties')}
        />
        <StatCard
          icon={<BedDouble size={20} strokeWidth={1.5} />}
          label="Rooms"
          value={loading ? '—' : String(roomCount)}
          onClick={() => navigate('/properties')}
        />
        <StatCard
          icon={<CalendarDays size={20} strokeWidth={1.5} />}
          label="Bookings"
          value="—"
          sublabel="Coming in phase 3"
        />
      </div>

      {/* Recent properties */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <p className="mono-accent" style={{ color: 'var(--text-secondary)' }}>Your properties</p>
          <button
            onClick={() => navigate('/properties')}
            style={{ fontSize: '0.875rem', color: 'var(--primary)', background: 'none', cursor: 'pointer' }}
          >
            View all
          </button>
        </div>

        {!loading && properties.length === 0 && (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            No properties yet.{' '}
            {(user?.role === 'owner' || user?.role === 'super_admin') && (
              <button
                onClick={() => navigate('/properties')}
                style={{ color: 'var(--primary)', background: 'none', cursor: 'pointer' }}
              >
                Add your first property →
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {properties.slice(0, 5).map((p) => (
            <button
              key={p.id}
              onClick={() => navigate(`/properties/${p.id}`)}
              className="glass-card"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '1rem 1.25rem', cursor: 'pointer', width: '100%', textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {p.logo_url ? (
                  <img src={p.logo_url} alt={p.name} style={{ width: '2rem', height: '2rem', borderRadius: '0.375rem', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '2rem', height: '2rem', borderRadius: '0.375rem',
                    background: 'color-mix(in oklab, var(--primary) 15%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
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

function StatCard({
  icon, label, value, sublabel, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sublabel?: string
  onClick?: () => void
}) {
  return (
    <div
      className="glass-card"
      onClick={onClick}
      style={{
        padding: '1.25rem',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', gap: '0.5rem',
      }}
    >
      <div style={{ color: 'var(--primary)' }}>{icon}</div>
      <p style={{ fontSize: '1.75rem', fontWeight: 300, lineHeight: 1 }}>{value}</p>
      <p className="mono-accent" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {sublabel && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sublabel}</p>}
    </div>
  )
}
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader, CalendarDays, ChevronRight, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'
import type { Database, BookingStatus } from '../types/database'

type Booking = Database['public']['Tables']['bookings']['Row']
type Property = Database['public']['Tables']['properties']['Row']

interface BookingWithDetails extends Booking {
  room_name: string
  room_type_name: string
  property_name: string
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  checked_in: '#10b981',
  checked_out: '#6b7280',
  cancelled: '#ef4444',
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
}

const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'checked_in']

export function BookingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [bookings, setBookings] = useState<BookingWithDetails[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filterProperty, setFilterProperty] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('active')
  const [search, setSearch] = useState('')

  const canCreate = user?.role !== undefined

  useEffect(() => {
    fetchProperties()
  }, [])

  useEffect(() => {
    fetchBookings()
  }, [filterProperty, filterStatus])

  async function fetchProperties() {
    const { data } = await supabase.from('properties').select('*').order('name')
    setProperties(data || [])
  }

  async function fetchBookings() {
    setLoading(true)
    setError(null)

    let query = supabase
      .from('bookings')
      .select(`
        *,
        rooms (
          name,
          room_types ( name ),
          properties ( name )
        )
      `)
      .order('check_in', { ascending: false })

    if (filterProperty !== 'all') {
      query = query.eq('property_id', filterProperty)
    }

    if (filterStatus === 'active') {
      query = query.in('status', ACTIVE_STATUSES)
    } else if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus as BookingStatus)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const mapped: BookingWithDetails[] = (data || []).map((b: any) => ({
      ...b,
      room_name: b.rooms?.name || '—',
      room_type_name: b.rooms?.room_types?.name || '—',
      property_name: b.rooms?.properties?.name || '—',
    }))

    setBookings(mapped)
    setLoading(false)
  }

  const filtered = bookings.filter(b => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      b.guest_name.toLowerCase().includes(q) ||
      b.guest_contact?.toLowerCase().includes(q) ||
      b.room_name.toLowerCase().includes(q)
    )
  })

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function nightCount(checkIn: string, checkOut: string) {
    const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime()
    return Math.round(diff / (1000 * 60 * 60 * 24))
  }

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>Bookings</p>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>Bookings</h2>
        </div>
        {canCreate && (
          <button
            onClick={() => navigate('/bookings/new')}
            className="glow-border"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, fontSize: '0.9375rem', cursor: 'pointer' }}
          >
            <Plus size={16} strokeWidth={1.5} /> New booking
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '12rem' }}>
          <Search size={15} strokeWidth={1.5} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search guest, phone, room…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '0.625rem 0.875rem 0.625rem 2.25rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.9375rem' }}
          />
        </div>

        {/* Property filter */}
        <select
          value={filterProperty}
          onChange={e => setFilterProperty(e.target.value)}
          style={{ padding: '0.625rem 0.875rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.875rem' }}
        >
          <option value="all">All properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '0.625rem 0.875rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.875rem' }}
        >
          <option value="active">Active bookings</option>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      {/* States */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', padding: '2rem 0' }}>
          <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading bookings…</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', color: '#ef4444' }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <CalendarDays size={40} strokeWidth={1} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
            {search ? 'No bookings match your search.' : 'No bookings found.'}
          </p>
        </div>
      )}

      {/* Bookings list */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {filtered.map(b => (
            <button
              key={b.id}
              onClick={() => navigate(`/bookings/${b.id}`)}
              className="glass-card"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', cursor: 'pointer', width: '100%', textAlign: 'left', gap: '1rem', flexWrap: 'wrap' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 0, flex: 1 }}>
                {/* Status dot */}
                <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: STATUS_COLORS[b.status], flexShrink: 0 }} />

                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: '0.9375rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.guest_name}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {b.property_name} · {b.room_type_name} · Room {b.room_name}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexShrink: 0, flexWrap: 'wrap' }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text)' }}>
                    {formatDate(b.check_in)} → {formatDate(b.check_out)}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {nightCount(b.check_in, b.check_out)} nights · {b.meal_plan} · {b.occupancy_type}
                  </p>
                </div>

                <div style={{ textAlign: 'right', minWidth: '6rem' }}>
                  <p style={{ fontWeight: 500, fontSize: '0.9375rem' }}>
                    KES {Number(b.total_amount).toLocaleString()}
                  </p>
                  <span style={{
                    display: 'inline-block', marginTop: '0.25rem',
                    padding: '0.125rem 0.5rem', borderRadius: '999px',
                    fontSize: '0.75rem', fontWeight: 500,
                    background: `color-mix(in oklab, ${STATUS_COLORS[b.status]} 15%, transparent)`,
                    color: STATUS_COLORS[b.status],
                  }}>
                    {STATUS_LABELS[b.status]}
                  </span>
                </div>

                <ChevronRight size={16} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
              </div>
            </button>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )
}
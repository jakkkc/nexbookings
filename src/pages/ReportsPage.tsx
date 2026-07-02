import { useEffect, useState } from 'react'
import { TrendingUp, CalendarDays, BedDouble, AlertCircle, Loader, LogIn, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AppLayout } from '../components/AppLayout'
import type { Database } from '../types/database'

type Property = Database['public']['Tables']['properties']['Row']

interface BookingReport {
  id: string
  property_id: string
  property_name: string
  room_name: string
  room_type_name: string
  guest_name: string
  check_in: string
  check_out: string
  occupancy_type: string
  meal_plan: string
  pax: number
  status: string
  source: string
  total_amount: number
  total_paid: number
  balance_due: number
  nights: number
}

interface Stats {
  total_revenue: number
  total_paid: number
  total_outstanding: number
  total_bookings: number
  cancelled_bookings: number
  avg_nights: number
  by_status: Record<string, number>
  by_room_type: Record<string, { bookings: number; revenue: number }>
  by_source: Record<string, number>
  by_property: Record<string, { bookings: number; revenue: number }>
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  confirmed: '#3b82f6',
  checked_in: '#10b981',
  checked_out: '#6b7280',
  cancelled: '#ef4444',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function startOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export function ReportsPage() {
  const [properties, setProperties] = useState<Property[]>([])
  const [filterProperty, setFilterProperty] = useState('all')
  const [dateFrom, setDateFrom] = useState(startOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [bookings, setBookings] = useState<BookingReport[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [checkInsToday, setCheckInsToday] = useState<BookingReport[]>([])
  const [checkOutsToday, setCheckOutsToday] = useState<BookingReport[]>([])
  const [currentGuests, setCurrentGuests] = useState<BookingReport[]>([])

  useEffect(() => {
    supabase.from('properties').select('*').order('name').then(({ data }: any) => setProperties(data || []))
  }, [])

  useEffect(() => { fetchReports() }, [filterProperty, dateFrom, dateTo])

  async function fetchReports() {
    setLoading(true)

    let query = (supabase as any)
      .from('booking_report_view')
      .select('*')
      .gte('check_in', dateFrom)
      .lte('check_in', dateTo)

    if (filterProperty !== 'all') {
      query = query.eq('property_id', filterProperty)
    }

    const { data, error } = await query.order('check_in', { ascending: false })

    if (error) { setLoading(false); return }

    const rows: BookingReport[] = data || []
    setBookings(rows)

    // Today's movements — query separately without date filter
    let todayQuery = (supabase as any).from('booking_report_view').select('*')
    if (filterProperty !== 'all') todayQuery = todayQuery.eq('property_id', filterProperty)
    const { data: allData } = await todayQuery

    const all: BookingReport[] = allData || []
    const todayStr = today()
    setCheckInsToday(all.filter(b => b.check_in === todayStr && b.status !== 'cancelled'))
    setCheckOutsToday(all.filter(b => b.check_out === todayStr && b.status !== 'cancelled'))
    setCurrentGuests(all.filter(b => b.status === 'checked_in'))

    // Compute stats
    const active = rows.filter(b => b.status !== 'cancelled')
    const totalRevenue = active.reduce((s, b) => s + Number(b.total_amount), 0)
    const totalPaid = active.reduce((s, b) => s + Number(b.total_paid), 0)
    const totalOutstanding = active.reduce((s, b) => s + Math.max(0, Number(b.balance_due)), 0)
    const avgNights = active.length > 0 ? active.reduce((s, b) => s + Number(b.nights), 0) / active.length : 0

    const byStatus: Record<string, number> = {}
    const byRoomType: Record<string, { bookings: number; revenue: number }> = {}
    const bySource: Record<string, number> = {}
    const byProperty: Record<string, { bookings: number; revenue: number }> = {}

    rows.forEach(b => {
      byStatus[b.status] = (byStatus[b.status] || 0) + 1
      bySource[b.source] = (bySource[b.source] || 0) + 1
      if (b.status !== 'cancelled') {
        const rt = b.room_type_name || 'Unknown'
        if (!byRoomType[rt]) byRoomType[rt] = { bookings: 0, revenue: 0 }
        byRoomType[rt].bookings++
        byRoomType[rt].revenue += Number(b.total_amount)
        const prop = b.property_name || 'Unknown'
        if (!byProperty[prop]) byProperty[prop] = { bookings: 0, revenue: 0 }
        byProperty[prop].bookings++
        byProperty[prop].revenue += Number(b.total_amount)
      }
    })

    setStats({
      total_revenue: totalRevenue,
      total_paid: totalPaid,
      total_outstanding: totalOutstanding,
      total_bookings: rows.length,
      cancelled_bookings: rows.filter(b => b.status === 'cancelled').length,
      avg_nights: avgNights,
      by_status: byStatus,
      by_room_type: byRoomType,
      by_source: bySource,
      by_property: byProperty,
    })

    setLoading(false)
  }

  return (
    <AppLayout>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>Reports</p>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>Reports & analytics</h2>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle}>Property</label>
          <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)} style={inputStyle}>
            <option value="all">All properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={inputStyle} />
        </div>
        {/* Quick ranges */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'This month', from: startOfMonth(), to: today() },
            { label: 'Last 30 days', from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0], to: today() },
            { label: 'Last 90 days', from: new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0], to: today() },
          ].map(r => (
            <button key={r.label} onClick={() => { setDateFrom(r.from); setDateTo(r.to) }}
              style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', padding: '2rem 0' }}>
          <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading reports…</span>
        </div>
      )}

      {!loading && stats && (
        <>
          {/* ── Today's snapshot ───────────────────────────────── */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p className="mono-accent" style={{ color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>Today</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '1rem' }}>
              <TodayCard icon={<LogIn size={18} strokeWidth={1.5} />} label="Checking in" count={checkInsToday.length} color="#10b981" items={checkInsToday.map(b => `${b.guest_name} — Room ${b.room_name}`)} />
              <TodayCard icon={<LogOut size={18} strokeWidth={1.5} />} label="Checking out" count={checkOutsToday.length} color="#6b7280" items={checkOutsToday.map(b => `${b.guest_name} — Room ${b.room_name}`)} />
              <TodayCard icon={<BedDouble size={18} strokeWidth={1.5} />} label="Current guests" count={currentGuests.length} color="#3b82f6" items={currentGuests.map(b => `${b.guest_name} — Room ${b.room_name}`)} />
            </div>
          </div>

          {/* ── Revenue stats ───────────────────────────────────── */}
          <p className="mono-accent" style={{ color: 'var(--text-secondary)', marginBottom: '0.875rem' }}>
            {fmt(dateFrom)} — {fmt(dateTo)}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <StatCard icon={<TrendingUp size={20} strokeWidth={1.5} />} label="Total revenue" value={`KES ${stats.total_revenue.toLocaleString()}`} sub="from active bookings" />
            <StatCard icon={<TrendingUp size={20} strokeWidth={1.5} />} label="Total paid" value={`KES ${stats.total_paid.toLocaleString()}`} sub="payments received" color="#10b981" />
            <StatCard icon={<AlertCircle size={20} strokeWidth={1.5} />} label="Outstanding" value={`KES ${stats.total_outstanding.toLocaleString()}`} sub="unpaid balances" color="#f59e0b" />
            <StatCard icon={<CalendarDays size={20} strokeWidth={1.5} />} label="Bookings" value={String(stats.total_bookings)} sub={`${stats.cancelled_bookings} cancelled`} />
            <StatCard icon={<BedDouble size={20} strokeWidth={1.5} />} label="Avg stay" value={`${stats.avg_nights.toFixed(1)} nights`} sub="per booking" />
          </div>

          {/* ── Breakdowns ──────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(20rem, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

            {/* By status */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>By status</p>
              {Object.entries(stats.by_status).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <div style={{ width: '0.5rem', height: '0.5rem', borderRadius: '50%', background: STATUS_COLORS[status] || '#6b7280' }} />
                    <span style={{ fontSize: '0.9375rem', textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
                  </div>
                  <span style={{ fontWeight: 500, color: STATUS_COLORS[status] || 'var(--text)' }}>{count}</span>
                </div>
              ))}
            </div>

            {/* By room type */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>By room type</p>
              {Object.entries(stats.by_room_type).sort((a, b) => b[1].revenue - a[1].revenue).map(([type, data]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <div>
                    <p style={{ fontSize: '0.9375rem' }}>{type}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{data.bookings} bookings</p>
                  </div>
                  <span style={{ fontWeight: 500 }}>KES {data.revenue.toLocaleString()}</span>
                </div>
              ))}
              {Object.keys(stats.by_room_type).length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No data</p>}
            </div>

            {/* By source */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>By source</p>
              {Object.entries(stats.by_source).map(([source, count]) => (
                <div key={source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.9375rem' }}>{source === 'whatsapp_ai' ? 'AI Assistant' : 'Manual'}</span>
                  <span style={{ fontWeight: 500 }}>{count}</span>
                </div>
              ))}
            </div>

            {/* By property (only if multiple) */}
            {Object.keys(stats.by_property).length > 1 && (
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>By property</p>
                {Object.entries(stats.by_property).sort((a, b) => b[1].revenue - a[1].revenue).map(([prop, data]) => (
                  <div key={prop} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)' }}>
                    <div>
                      <p style={{ fontSize: '0.9375rem' }}>{prop}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{data.bookings} bookings</p>
                    </div>
                    <span style={{ fontWeight: 500 }}>KES {data.revenue.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Bookings table ──────────────────────────────────── */}
          <div className="glass-card" style={{ padding: '1.25rem' }}>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>
              All bookings ({bookings.length})
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr>
                    {['Guest', 'Property', 'Room type', 'Check-in', 'Check-out', 'Nights', 'Meal', 'Status', 'Total', 'Paid', 'Balance'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 500, color: 'var(--text-secondary)', borderBottom: '1px solid var(--glass-border)', whiteSpace: 'nowrap', fontSize: '0.8125rem' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                      <td style={tdStyle}>{b.guest_name}</td>
                      <td style={tdStyle}>{b.property_name}</td>
                      <td style={tdStyle}>{b.room_type_name || '—'}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmt(b.check_in)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>{fmt(b.check_out)}</td>
                      <td style={tdStyle}>{b.nights}</td>
                      <td style={tdStyle}>{b.meal_plan}</td>
                      <td style={tdStyle}>
                        <span style={{
                          padding: '0.125rem 0.5rem', borderRadius: '999px',
                          fontSize: '0.75rem', fontWeight: 500,
                          background: `color-mix(in oklab, ${STATUS_COLORS[b.status] || '#6b7280'} 15%, transparent)`,
                          color: STATUS_COLORS[b.status] || '#6b7280',
                        }}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>KES {Number(b.total_amount).toLocaleString()}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: '#10b981' }}>KES {Number(b.total_paid).toLocaleString()}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', color: Number(b.balance_due) > 0 ? '#f59e0b' : '#10b981' }}>
                        KES {Math.max(0, Number(b.balance_due)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  {bookings.length === 0 && (
                    <tr>
                      <td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No bookings in this date range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ color: color || 'var(--primary)' }}>{icon}</div>
      <p style={{ fontSize: '1.5rem', fontWeight: 300, lineHeight: 1, color: color || 'var(--text)' }}>{value}</p>
      <p className="mono-accent" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {sub && <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sub}</p>}
    </div>
  )
}

function TodayCard({ icon, label, count, color, items }: { icon: React.ReactNode; label: string; count: number; color: string; items: string[] }) {
  return (
    <div className="glass-card" style={{ padding: '1.25rem', borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ color }}>{icon}</div>
        <p style={{ fontWeight: 500 }}>{label}</p>
        <span style={{ marginLeft: 'auto', fontWeight: 600, fontSize: '1.25rem', color }}>{count}</span>
      </div>
      {items.length === 0
        ? <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>None today</p>
        : items.map((item, i) => (
          <p key={i} style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: '0.25rem 0', borderBottom: i < items.length - 1 ? '1px solid var(--glass-border)' : 'none' }}>
            {item}
          </p>
        ))
      }
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }
const inputStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.875rem' }
const tdStyle: React.CSSProperties = { padding: '0.625rem 0.75rem', color: 'var(--text)' }
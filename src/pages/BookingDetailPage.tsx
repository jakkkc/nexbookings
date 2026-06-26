import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Loader, Plus, Trash2, Upload,
  XCircle, LogIn, LogOut, CheckCircle, Pencil, Printer,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'
import type { Database, BookingStatus, PaymentType, OccupancyType, MealPlan } from '../types/database'

type Booking = Database['public']['Tables']['bookings']['Row']
type Payment = Database['public']['Tables']['payments']['Row']
type RoomType = Database['public']['Tables']['room_types']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

interface BookingDetail extends Booking {
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

const MEAL_LABELS: Record<string, string> = {
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
}

function nightsBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}
function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)

  // Edit booking
  const [showEditForm, setShowEditForm] = useState(false)
  const [editForm, setEditForm] = useState({
    guest_name: '',
    guest_contact: '',
    check_in: '',
    check_out: '',
    occupancy_type: 'double' as OccupancyType,
    meal_plan: 'BB' as MealPlan,
    pax: 1,
    total_amount: 0,
    notes: '',
    room_id: '',
  })
  const [editRooms, setEditRooms] = useState<Room[]>([])
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // Payment form
  const [showPayForm, setShowPayForm] = useState(false)
  const [payForm, setPayForm] = useState({
    amount: 0,
    payment_type: 'deposit' as PaymentType,
    discount_amount: 0,
    discount_pct: 0,
    notes: '',
  })
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docName, setDocName] = useState('')
  const [paySaving, setPaySaving] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [deletingPayId, setDeletingPayId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const canManage = user?.role !== undefined

  useEffect(() => { if (id) fetchData() }, [id])

  async function fetchData() {
    setLoading(true)
    const [bookRes, payRes] = await Promise.all([
      supabase.from('bookings').select(`
        *, rooms ( name, room_types ( name ), properties ( name ) )
      `).eq('id', id!).single(),
      supabase.from('payments').select('*').eq('booking_id', id!).order('recorded_at'),
    ])

    if (bookRes.error) { setError(bookRes.error.message); setLoading(false); return }
    const b = bookRes.data as any
    const detail: BookingDetail = {
      ...b,
      room_name: b.rooms?.name || '—',
      room_type_name: b.rooms?.room_types?.name || '—',
      property_name: b.rooms?.properties?.name || '—',
    }
    setBooking(detail)
    setPayments(payRes.data || [])

    // Seed edit form
    setEditForm({
      guest_name: detail.guest_name,
      guest_contact: detail.guest_contact || '',
      check_in: detail.check_in,
      check_out: detail.check_out,
      occupancy_type: detail.occupancy_type,
      meal_plan: detail.meal_plan,
      pax: detail.pax,
      total_amount: Number(detail.total_amount),
      notes: detail.notes || '',
      room_id: detail.room_id,
    })

    // Load rooms for the same room type so user can switch room
    if (b.rooms?.room_types) {
      const { data: rtRooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('property_id', detail.property_id)
        .order('name')
      setEditRooms(rtRooms || [])
    }

    setLoading(false)
  }

  async function updateStatus(newStatus: BookingStatus) {
    if (!booking) return
    setStatusUpdating(true)
    await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id)
    await fetchData()
    setStatusUpdating(false)
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!booking) return
    setEditSaving(true)
    setEditError(null)

    const { error } = await supabase.from('bookings').update({
      guest_name: editForm.guest_name.trim(),
      guest_contact: editForm.guest_contact.trim() || null,
      check_in: editForm.check_in,
      check_out: editForm.check_out,
      occupancy_type: editForm.occupancy_type,
      meal_plan: editForm.meal_plan,
      pax: editForm.pax,
      total_amount: editForm.total_amount,
      notes: editForm.notes.trim() || null,
      room_id: editForm.room_id,
    }).eq('id', booking.id)

    if (error) { setEditError(error.message); setEditSaving(false); return }
    setShowEditForm(false)
    await fetchData()
    setEditSaving(false)
  }

  async function handleDelete() {
    if (!booking) return
    if (!confirm('Permanently delete this booking? This cannot be undone.')) return
    await supabase.from('bookings').delete().eq('id', booking.id)
    navigate('/bookings')
  }

  function handleDocChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDocFile(file)
    setDocName(file.name)
  }

  async function handlePaySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !booking) return
    setPaySaving(true)
    setPayError(null)

    let docUrl: string | null = null
    if (docFile) {
      const path = `${booking.id}/${Date.now()}-${docFile.name}`
      const { error: uploadErr } = await supabase.storage.from('payment-docs').upload(path, docFile)
      if (uploadErr) { setPayError(uploadErr.message); setPaySaving(false); return }
      const { data } = supabase.storage.from('payment-docs').getPublicUrl(path)
      docUrl = data.publicUrl
    }

    const effectiveDiscount = payForm.discount_pct > 0
      ? (payForm.amount * payForm.discount_pct) / 100
      : payForm.discount_amount

    const { error } = await supabase.from('payments').insert({
      booking_id: booking.id,
      amount: payForm.amount,
      payment_type: payForm.payment_type,
      discount_amount: effectiveDiscount,
      discount_pct: payForm.discount_pct,
      document_url: docUrl,
      notes: payForm.notes.trim() || null,
      recorded_by: user.id,
    })

    if (error) { setPayError(error.message); setPaySaving(false); return }
    setShowPayForm(false)
    setPayForm({ amount: 0, payment_type: 'deposit', discount_amount: 0, discount_pct: 0, notes: '' })
    setDocFile(null)
    setDocName('')
    await fetchData()
    setPaySaving(false)
  }

  async function handleDeletePayment(payId: string) {
    if (!confirm('Delete this payment record?')) return
    setDeletingPayId(payId)
    await supabase.from('payments').delete().eq('id', payId)
    await fetchData()
    setDeletingPayId(null)
  }

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount) - Number(p.discount_amount), 0)
  const totalDue = booking ? Number(booking.total_amount) : 0
  const balance = totalDue - totalPaid

  function statusActions(status: BookingStatus) {
    const cancel = { label: 'Cancel booking', next: 'cancelled' as BookingStatus, icon: <XCircle size={14} strokeWidth={1.5} />, color: '#ef4444' }
    switch (status) {
      case 'pending': return [
        { label: 'Confirm', next: 'confirmed' as BookingStatus, icon: <CheckCircle size={14} strokeWidth={1.5} />, color: '#3b82f6' },
        cancel,
      ]
      case 'confirmed': return [
        { label: 'Check in', next: 'checked_in' as BookingStatus, icon: <LogIn size={14} strokeWidth={1.5} />, color: '#10b981' },
        cancel,
      ]
      case 'checked_in': return [
        { label: 'Check out', next: 'checked_out' as BookingStatus, icon: <LogOut size={14} strokeWidth={1.5} />, color: '#6b7280' },
        cancel,
      ]
      case 'checked_out': return [cancel]
      case 'cancelled': return []
    }
  }

  if (loading) return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-secondary)', padding: '2rem 0' }}>
        <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Loading…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )

  if (!booking) return (
    <AppLayout><div style={{ color: '#ef4444' }}>{error || 'Booking not found.'}</div></AppLayout>
  )

  const nights = nightsBetween(booking.check_in, booking.check_out)
  const actions = statusActions(booking.status)

  return (
    <AppLayout>
      <button onClick={() => navigate('/bookings')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', background: 'none', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} strokeWidth={1.5} /> All bookings
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>Booking</p>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 300 }}>{booking.guest_name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{
              padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.8125rem', fontWeight: 500,
              background: `color-mix(in oklab, ${STATUS_COLORS[booking.status]} 15%, transparent)`,
              color: STATUS_COLORS[booking.status],
            }}>
              {STATUS_LABELS[booking.status]}
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              {booking.property_name} · {booking.room_type_name} · Room {booking.room_name}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Print menu */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowPrintMenu(!showPrintMenu)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.625rem 1rem', borderRadius: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              <Printer size={14} strokeWidth={1.5} /> Print
            </button>
            {showPrintMenu && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.375rem', background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', padding: '0.375rem', zIndex: 50, minWidth: '12rem', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                {(['confirmation', 'invoice', 'receipt'] as const).map(doc => (
                  <button
                    key={doc}
                    onClick={() => { window.open(`/bookings/${booking.id}/print?doc=${doc}`, '_blank'); setShowPrintMenu(false) }}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.625rem 0.875rem', borderRadius: '0.375rem', background: 'none', color: 'var(--text)', cursor: 'pointer', fontSize: '0.875rem', textTransform: 'capitalize' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in oklab, var(--primary) 10%, transparent)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    {doc === 'confirmation' ? 'Booking confirmation' : doc.charAt(0).toUpperCase() + doc.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Edit button — always available unless cancelled/checked_out */}
          {canManage && booking.status !== 'cancelled' && (
            <button
              onClick={() => setShowEditForm(!showEditForm)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.625rem 1rem', borderRadius: '0.5rem',
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)',
                color: 'var(--text)', cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              <Pencil size={14} strokeWidth={1.5} /> Edit booking
            </button>
          )}

          {/* Status actions */}
          {canManage && actions.map(action => (
            <button
              key={action.next}
              onClick={() => updateStatus(action.next)}
              disabled={statusUpdating}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                padding: '0.625rem 1rem', borderRadius: '0.5rem',
                background: `color-mix(in oklab, ${action.color} 15%, transparent)`,
                border: `1px solid ${action.color}`,
                color: action.color, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500,
                opacity: statusUpdating ? 0.6 : 1,
              }}
            >
              {action.icon}{action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Edit form */}
      {showEditForm && (
        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1.25rem' }}>Edit booking</p>
          {editError && (
            <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
              {editError}
            </div>
          )}
          <form onSubmit={handleEditSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Guest name</label>
              <input type="text" required value={editForm.guest_name} onChange={e => setEditForm(f => ({ ...f, guest_name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Phone / contact</label>
              <input type="text" value={editForm.guest_contact} onChange={e => setEditForm(f => ({ ...f, guest_contact: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Check-in</label>
              <input type="date" required value={editForm.check_in} onChange={e => setEditForm(f => ({ ...f, check_in: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Check-out</label>
              <input type="date" required value={editForm.check_out} min={editForm.check_in} onChange={e => setEditForm(f => ({ ...f, check_out: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Occupancy</label>
              <select value={editForm.occupancy_type} onChange={e => setEditForm(f => ({ ...f, occupancy_type: e.target.value as OccupancyType }))} style={inputStyle}>
                <option value="single">Single</option>
                <option value="double">Double</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Meal plan</label>
              <select value={editForm.meal_plan} onChange={e => setEditForm(f => ({ ...f, meal_plan: e.target.value as MealPlan }))} style={inputStyle}>
                <option value="BB">Bed & Breakfast</option>
                <option value="HB">Half Board</option>
                <option value="FB">Full Board</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>No. of guests</label>
              <input type="number" min={1} max={20} value={editForm.pax} onChange={e => setEditForm(f => ({ ...f, pax: parseInt(e.target.value) || 1 }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Total amount (KES)</label>
              <input type="number" min={0} step={0.01} value={editForm.total_amount} onChange={e => setEditForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Room</label>
              <select value={editForm.room_id} onChange={e => setEditForm(f => ({ ...f, room_id: e.target.value }))} style={inputStyle}>
                {editRooms.map(r => <option key={r.id} value={r.id}>Room {r.name}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Notes</label>
              <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem' }}>
              <button type="submit" disabled={editSaving} style={{ padding: '0.625rem 1.5rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, cursor: editSaving ? 'not-allowed' : 'pointer', opacity: editSaving ? 0.7 : 1, fontSize: '0.9375rem' }}>
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={() => { setShowEditForm(false); setEditError(null) }} style={{ padding: '0.625rem 1rem', borderRadius: '0.5rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.9375rem' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

        {/* Left: booking details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Stay details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.9375rem' }}>
              <Row label="Check-in" value={fmt(booking.check_in)} />
              <Row label="Check-out" value={fmt(booking.check_out)} />
              <Row label="Nights" value={String(nights)} />
              <Row label="Occupancy" value={booking.occupancy_type.charAt(0).toUpperCase() + booking.occupancy_type.slice(1)} />
              <Row label="Guests" value={String(booking.pax)} />
              <Row label="Meal plan" value={MEAL_LABELS[booking.meal_plan] || booking.meal_plan} />
              {booking.notes && <Row label="Notes" value={booking.notes} />}
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Guest</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.9375rem' }}>
              <Row label="Name" value={booking.guest_name} />
              {booking.guest_contact && <Row label="Contact" value={booking.guest_contact} />}
            </div>
          </div>

          {isOwner && booking.status === 'cancelled' && (
            <div className="glass-card" style={{ padding: '1.25rem', border: '1px solid #ef4444' }}>
              <p className="mono-accent" style={{ color: '#ef4444', marginBottom: '0.75rem' }}>Danger zone</p>
              <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '0.5rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', color: '#ef4444', cursor: 'pointer', fontSize: '0.875rem' }}>
                <Trash2 size={14} strokeWidth={1.5} /> Permanently delete booking
              </button>
            </div>
          )}
        </div>

        {/* Right: payments */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Payment summary</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', fontSize: '0.9375rem' }}>
              <Row label="Total due" value={`KES ${totalDue.toLocaleString()}`} />
              <Row label="Total paid" value={`KES ${totalPaid.toLocaleString()}`} />
              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.625rem', marginTop: '0.25rem' }}>
                <Row
                  label="Balance"
                  value={`KES ${Math.abs(balance).toLocaleString()}${balance < 0 ? ' (overpaid)' : ''}`}
                  valueColor={balance <= 0 ? '#10b981' : '#f59e0b'}
                />
              </div>
            </div>
          </div>

          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <p className="mono-accent" style={{ color: 'var(--primary)' }}>Payments</p>
              {canManage && booking.status !== 'cancelled' && (
                <button onClick={() => setShowPayForm(!showPayForm)} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                  <Plus size={13} strokeWidth={1.5} /> Add payment
                </button>
              )}
            </div>

            {showPayForm && (
              <div style={{ marginBottom: '1.25rem', padding: '1.25rem', background: 'color-mix(in oklab, var(--primary) 6%, transparent)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem' }}>
                {payError && (
                  <div style={{ padding: '0.625rem 0.875rem', marginBottom: '0.875rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.375rem', fontSize: '0.8125rem', color: '#ef4444' }}>
                    {payError}
                  </div>
                )}
                <form onSubmit={handlePaySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={smLabelStyle}>Type</label>
                      <select value={payForm.payment_type} onChange={e => setPayForm(f => ({ ...f, payment_type: e.target.value as PaymentType }))} style={smInputStyle}>
                        <option value="deposit">Deposit</option>
                        <option value="balance">Balance</option>
                      </select>
                    </div>
                    <div>
                      <label style={smLabelStyle}>Amount (KES)</label>
                      <input type="number" required min={1} step={0.01} value={payForm.amount || ''} onChange={e => setPayForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} style={smInputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={smLabelStyle}>Discount (KES)</label>
                      <input type="number" min={0} step={0.01} value={payForm.discount_amount || ''} onChange={e => setPayForm(f => ({ ...f, discount_amount: parseFloat(e.target.value) || 0, discount_pct: 0 }))} placeholder="0" style={smInputStyle} />
                    </div>
                    <div>
                      <label style={smLabelStyle}>Discount (%)</label>
                      <input type="number" min={0} max={100} step={0.1} value={payForm.discount_pct || ''} onChange={e => setPayForm(f => ({ ...f, discount_pct: parseFloat(e.target.value) || 0, discount_amount: 0 }))} placeholder="0" style={smInputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={smLabelStyle}>Notes (optional)</label>
                    <input type="text" value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="M-Pesa ref, bank transfer…" style={smInputStyle} />
                  </div>
                  <div>
                    <label style={smLabelStyle}>Attach document (optional)</label>
                    <button type="button" onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.5rem 0.875rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.8125rem' }}>
                      <Upload size={13} strokeWidth={1.5} />
                      {docName || 'Upload M-Pesa screenshot / slip'}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*,.pdf" onChange={handleDocChange} style={{ display: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.625rem' }}>
                    <button type="submit" disabled={paySaving || !payForm.amount} style={{ flex: 1, padding: '0.5rem', borderRadius: '0.375rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 500, cursor: paySaving ? 'not-allowed' : 'pointer', opacity: paySaving ? 0.7 : 1, fontSize: '0.875rem' }}>
                      {paySaving ? 'Saving…' : 'Save payment'}
                    </button>
                    <button type="button" onClick={() => { setShowPayForm(false); setPayError(null) }} style={{ padding: '0.5rem 0.875rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.875rem' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {payments.length === 0 && !showPayForm && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No payments recorded yet.</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {payments.map(p => (
                <div key={p.id} style={{ padding: '0.875rem 1rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: '0.9375rem' }}>
                        KES {Number(p.amount).toLocaleString()}
                        {Number(p.discount_amount) > 0 && (
                          <span style={{ fontSize: '0.8125rem', color: '#10b981', marginLeft: '0.5rem' }}>
                            − KES {Number(p.discount_amount).toLocaleString()} discount
                          </span>
                        )}
                      </p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                        {p.payment_type.charAt(0).toUpperCase() + p.payment_type.slice(1)} ·{' '}
                        {new Date(p.recorded_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {p.notes && ` · ${p.notes}`}
                      </p>
                      {p.document_url && (
                        <a href={p.document_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--primary)', marginTop: '0.25rem', display: 'inline-block' }}>
                          View document →
                        </a>
                      )}
                    </div>
                    {isOwner && (
                      <button onClick={() => handleDeletePayment(p.id)} disabled={deletingPayId === p.id} style={{ padding: '0.25rem', borderRadius: '0.25rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', opacity: deletingPayId === p.id ? 0.5 : 1, flexShrink: 0 }}>
                        <Trash2 size={13} strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ color: valueColor || 'var(--text)', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.9375rem' }
const smLabelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }
const smInputStyle: React.CSSProperties = { width: '100%', padding: '0.5rem 0.75rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.375rem', color: 'var(--text)', fontSize: '0.875rem' }
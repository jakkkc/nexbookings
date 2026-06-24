import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'
import type { Database, RoomPrices, OccupancyType, MealPlan } from '../types/database'

type Property = Database['public']['Tables']['properties']['Row']
type RoomType = Database['public']['Tables']['room_types']['Row']
type Room = Database['public']['Tables']['rooms']['Row']

const MEAL_LABELS: Record<MealPlan, string> = {
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
}

function calcPrice(prices: RoomPrices, occupancy: OccupancyType, meal: MealPlan, pax: number, nights: number): number {
  const mealKey = meal.toLowerCase() as 'bb' | 'hb' | 'fb'
  const base = occupancy === 'single' ? prices.single[mealKey] : prices.double[mealKey]
  const extraPax = Math.max(0, pax - 2)
  const extraRate = prices.extra_pax[mealKey]
  return (base + extraPax * extraRate) * nights
}

function nightsBetween(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}

export function NewBookingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [properties, setProperties] = useState<Property[]>([])
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [availableRooms, setAvailableRooms] = useState<Room[]>([])
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [availabilityChecked, setAvailabilityChecked] = useState(false)

  const [form, setForm] = useState({
    property_id: '',
    room_type_id: '',
    room_id: '',
    guest_name: '',
    guest_contact: '',
    check_in: '',
    check_out: '',
    occupancy_type: 'double' as OccupancyType,
    meal_plan: 'BB' as MealPlan,
    pax: 2,
    total_amount: 0,
    price_overridden: false,
    notes: '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRoomType = roomTypes.find(rt => rt.id === form.room_type_id)
  const nights = nightsBetween(form.check_in, form.check_out)

  // Load properties on mount
  useEffect(() => {
    supabase.from('properties').select('*').order('name').then(({ data }) => {
      setProperties(data || [])
      if (data?.length === 1) setForm(f => ({ ...f, property_id: data[0].id }))
    })
  }, [])

  // Load room types when property changes
  useEffect(() => {
    if (!form.property_id) { setRoomTypes([]); return }
    supabase.from('room_types').select('*').eq('property_id', form.property_id).order('name')
      .then(({ data }) => setRoomTypes(data || []))
    setForm(f => ({ ...f, room_type_id: '', room_id: '' }))
    setAvailableRooms([])
    setAvailabilityChecked(false)
  }, [form.property_id])

  // Load rooms when room type changes
  useEffect(() => {
    if (!form.room_type_id) { setRooms([]); return }
    supabase.from('rooms').select('*').eq('room_type_id', form.room_type_id).order('name')
      .then(({ data }) => setRooms(data || []))
    setForm(f => ({ ...f, room_id: '' }))
    setAvailableRooms([])
    setAvailabilityChecked(false)
  }, [form.room_type_id])

  // Recalculate price when relevant fields change (unless overridden)
  useEffect(() => {
    if (!selectedRoomType || !nights || form.price_overridden) return
    const calculated = calcPrice(selectedRoomType.prices, form.occupancy_type, form.meal_plan, form.pax, nights)
    setForm(f => ({ ...f, total_amount: calculated }))
  }, [form.room_type_id, form.occupancy_type, form.meal_plan, form.pax, nights, form.price_overridden])

  async function checkAvailability() {
    if (!form.room_type_id || !form.check_in || !form.check_out) return
    setCheckingAvailability(true)
    setAvailabilityChecked(false)

    // Get all rooms of this type that have NO conflicting booking
    const { data: bookedRooms } = await supabase
      .from('room_bookings_view')
      .select('room_id')
      .in('room_id', rooms.map(r => r.id))
      .lt('check_in', form.check_out)
      .gt('check_out', form.check_in)

    const bookedIds = new Set((bookedRooms || []).map((r: any) => r.room_id))
    const available = rooms.filter(r => !bookedIds.has(r.id))
    setAvailableRooms(available)
    setAvailabilityChecked(true)
    setCheckingAvailability(false)

    if (available.length > 0) {
      setForm(f => ({ ...f, room_id: available[0].id }))
    } else {
      setForm(f => ({ ...f, room_id: '' }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.room_id) { setError('Please select an available room.'); return }
    if (nights <= 0) { setError('Check-out must be after check-in.'); return }

    setSaving(true)
    setError(null)

    const { data, error } = await supabase.from('bookings').insert({
      property_id: form.property_id,
      room_id: form.room_id,
      guest_name: form.guest_name.trim(),
      guest_contact: form.guest_contact.trim() || null,
      check_in: form.check_in,
      check_out: form.check_out,
      occupancy_type: form.occupancy_type,
      meal_plan: form.meal_plan,
      pax: form.pax,
      total_amount: form.total_amount,
      notes: form.notes.trim() || null,
      source: 'manual',
      status: 'pending',
      created_by: user.id,
    }).select().single()

    setSaving(false)

    if (error) { setError(error.message); return }
    navigate(`/bookings/${data.id}`)
  }

  const canCheckAvailability = form.room_type_id && form.check_in && form.check_out && nights > 0

  return (
    <AppLayout>
      <button onClick={() => navigate('/bookings')} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: 'var(--text-secondary)', background: 'none', cursor: 'pointer', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} strokeWidth={1.5} /> All bookings
      </button>

      <div style={{ marginBottom: '2rem' }}>
        <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>New booking</p>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>Create booking</h2>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.875rem 1rem', marginBottom: '1.25rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
          <AlertCircle size={15} strokeWidth={1.5} />{error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Section: Room selection */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Room selection</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Property</label>
                <select required value={form.property_id} onChange={e => setForm(f => ({ ...f, property_id: e.target.value }))} style={inputStyle}>
                  <option value="">Select property…</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Room type</label>
                <select required value={form.room_type_id} onChange={e => setForm(f => ({ ...f, room_type_id: e.target.value }))} disabled={!form.property_id} style={inputStyle}>
                  <option value="">Select room type…</option>
                  {roomTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name} (max {rt.max_pax} pax)</option>)}
                </select>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Check-in</label>
                  <input type="date" required value={form.check_in} min={new Date().toISOString().split('T')[0]} onChange={e => { setForm(f => ({ ...f, check_in: e.target.value, room_id: '' })); setAvailabilityChecked(false) }} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Check-out</label>
                  <input type="date" required value={form.check_out} min={form.check_in || new Date().toISOString().split('T')[0]} onChange={e => { setForm(f => ({ ...f, check_out: e.target.value, room_id: '' })); setAvailabilityChecked(false) }} style={inputStyle} />
                </div>
              </div>

              {nights > 0 && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--primary)' }}>
                  {nights} night{nights !== 1 ? 's' : ''}
                </p>
              )}

              {/* Availability check */}
              <button
                type="button"
                onClick={checkAvailability}
                disabled={!canCheckAvailability || checkingAvailability}
                style={{
                  padding: '0.625rem', borderRadius: '0.5rem',
                  background: canCheckAvailability ? 'color-mix(in oklab, var(--primary) 15%, transparent)' : 'var(--glass-bg)',
                  border: '1px solid var(--primary)',
                  color: canCheckAvailability ? 'var(--primary)' : 'var(--text-secondary)',
                  cursor: canCheckAvailability ? 'pointer' : 'not-allowed',
                  fontSize: '0.9375rem', fontWeight: 500,
                }}
              >
                {checkingAvailability ? 'Checking…' : 'Check availability'}
              </button>

              {availabilityChecked && (
                <div>
                  {availableRooms.length === 0 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', background: 'color-mix(in oklab, #ef4444 12%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
                      <AlertCircle size={14} strokeWidth={1.5} />
                      No rooms available for these dates.
                    </div>
                  ) : (
                    <div>
                      <label style={labelStyle}>Available room ({availableRooms.length} available)</label>
                      <select required value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} style={inputStyle}>
                        {availableRooms.map(r => <option key={r.id} value={r.id}>Room {r.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Section: Stay details */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Stay details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Occupancy</label>
                  <select value={form.occupancy_type} onChange={e => setForm(f => ({ ...f, occupancy_type: e.target.value as OccupancyType, price_overridden: false }))} style={inputStyle}>
                    <option value="single">Single</option>
                    <option value="double">Double</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>No. of guests</label>
                  <input type="number" min={1} max={selectedRoomType?.max_pax || 20} value={form.pax} onChange={e => setForm(f => ({ ...f, pax: parseInt(e.target.value) || 1, price_overridden: false }))} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Meal plan</label>
                <select value={form.meal_plan} onChange={e => setForm(f => ({ ...f, meal_plan: e.target.value as MealPlan, price_overridden: false }))} style={inputStyle}>
                  {Object.entries(MEAL_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Price */}
              <div>
                <label style={labelStyle}>
                  Total amount (KES)
                  {form.price_overridden && (
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#f59e0b' }}>· manually set</span>
                  )}
                </label>
                <input
                  type="number" min={0} step={0.01}
                  value={form.total_amount}
                  onChange={e => setForm(f => ({ ...f, total_amount: parseFloat(e.target.value) || 0, price_overridden: true }))}
                  style={inputStyle}
                />
                {selectedRoomType && nights > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const calculated = calcPrice(selectedRoomType.prices, form.occupancy_type, form.meal_plan, form.pax, nights)
                      setForm(f => ({ ...f, total_amount: calculated, price_overridden: false }))
                    }}
                    style={{ marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--primary)', background: 'none', cursor: 'pointer' }}
                  >
                    Reset to calculated price (KES {calcPrice(selectedRoomType.prices, form.occupancy_type, form.meal_plan, form.pax, nights).toLocaleString()})
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Section: Guest info */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Guest information</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Full name</label>
                <input type="text" required value={form.guest_name} onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))} placeholder="John Kamau" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone / contact</label>
                <input type="tel" value={form.guest_contact} onChange={e => setForm(f => ({ ...f, guest_contact: e.target.value }))} placeholder="+254 7XX XXX XXX" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Special requests, dietary requirements…" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
            </div>
          </div>

          {/* Summary + submit */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Summary</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              {form.property_id && <p>Property: <span style={{ color: 'var(--text)' }}>{properties.find(p => p.id === form.property_id)?.name}</span></p>}
              {selectedRoomType && <p>Room type: <span style={{ color: 'var(--text)' }}>{selectedRoomType.name}</span></p>}
              {form.room_id && <p>Room: <span style={{ color: 'var(--text)' }}>{availableRooms.find(r => r.id === form.room_id)?.name}</span></p>}
              {nights > 0 && <p>Nights: <span style={{ color: 'var(--text)' }}>{nights}</span></p>}
              {form.total_amount > 0 && (
                <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text)', marginTop: '0.5rem' }}>
                  Total: KES {Number(form.total_amount).toLocaleString()}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || !form.room_id || !form.guest_name.trim()}
              className="glow-border"
              style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', background: 'var(--primary)', color: 'var(--bg)', fontWeight: 600, fontSize: '0.9375rem', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Creating booking…' : 'Create booking'}
            </button>
          </div>
        </div>
      </form>
    </AppLayout>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.9375rem' }
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Copy, Check, AlertCircle, Loader, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AppLayout } from '../components/AppLayout'

interface Property {
  id: string
  name: string
}

interface ParsedResult {
  check_in: string | null
  check_out: string | null
  pax: number
  meal_plan: 'BB' | 'HB' | 'FB'
  occupancy_type: 'single' | 'double'
  guest_name: string | null
  guest_contact: string | null
  matched_room_type_id: string | null
  matched_room_type_name: string | null
  nights: number
  total_amount: number
  needs_clarification: boolean
}

interface AIResponse {
  parsed: ParsedResult
  reply_message: string
  available_room_id: string | null
  available_room_name: string | null
  is_available: boolean
}

const MEAL_LABELS: Record<string, string> = { BB: 'Bed & Breakfast', HB: 'Half Board', FB: 'Full Board' }

export function AssistantPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [properties, setProperties] = useState<Property[]>([])
  const [propertyId, setPropertyId] = useState('')
  const [inquiry, setInquiry] = useState('')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AIResponse | null>(null)
  const [editedResult, setEditedResult] = useState<ParsedResult | null>(null)
  const [copied, setCopied] = useState(false)
  const [booking, setBooking] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('properties').select('id, name').order('name').then(({ data }: any) => {
      setProperties(data || [])
      if (data?.length === 1) setPropertyId(data[0].id)
    })
  }, [])

  async function handleGenerate() {
    if (!propertyId || !inquiry.trim()) return
    setGenerating(true)
    setError(null)
    setResult(null)
    setBookingSuccess(null)

    const { data: { session } } = await supabase.auth.getSession()

    const { data, error: fnError } = await supabase.functions.invoke('ai-reply', {
      body: { property_id: propertyId, inquiry_text: inquiry },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })

    setGenerating(false)

    if (fnError) {
      setError(fnError.message || 'Failed to generate reply')
      return
    }
    if (data?.error) {
      setError(data.error)
      return
    }

    setResult(data)
    setEditedResult(data.parsed)
  }

  function copyReply() {
    if (!result) return
    navigator.clipboard.writeText(result.reply_message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleBookIt() {
    if (!editedResult || !user || !result?.available_room_id) return
    setBooking(true)
    setError(null)

    const { error: bookError } = await supabase.from('bookings').insert({
      property_id: propertyId,
      room_id: result.available_room_id,
      guest_name: editedResult.guest_name || 'Guest',
      guest_contact: editedResult.guest_contact || null,
      check_in: editedResult.check_in,
      check_out: editedResult.check_out,
      occupancy_type: editedResult.occupancy_type,
      meal_plan: editedResult.meal_plan,
      pax: editedResult.pax,
      total_amount: editedResult.total_amount,
      source: 'whatsapp_ai',
      status: 'pending',
      created_by: user.id,
    } as any).select().single()

    setBooking(false)

    if (bookError) {
      setError(bookError.message)
      return
    }

    setBookingSuccess('Booking created successfully!')
  }

  const canBook = result?.is_available && editedResult?.check_in && editedResult?.check_out && editedResult.guest_name

  return (
    <AppLayout>
      <div style={{ marginBottom: '2rem' }}>
        <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '0.375rem' }}>AI Assistant</p>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 300 }}>Booking inquiry assistant</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.5rem' }}>
          Paste a guest inquiry from WhatsApp or email — in English, Swahili, or Sheng — and get an instant availability check with a ready-to-send reply.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(22rem, 1fr))', gap: '1.5rem', alignItems: 'start' }}>

        {/* Left: input */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Guest inquiry</p>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Property</label>
            <select value={propertyId} onChange={e => setPropertyId(e.target.value)} style={inputStyle}>
              <option value="">Select property…</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Inquiry message</label>
            <textarea
              value={inquiry}
              onChange={e => setInquiry(e.target.value)}
              placeholder='e.g. "Niaje, kuna room ya watu wawili from 15th to 18th August? Tunataka BB tu"'
              rows={6}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', background: 'color-mix(in oklab, #ef4444 15%, transparent)', border: '1px solid #ef4444', borderRadius: '0.5rem', fontSize: '0.875rem', color: '#ef4444' }}>
              <AlertCircle size={15} strokeWidth={1.5} />{error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !propertyId || !inquiry.trim()}
            className="glow-border"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.75rem', borderRadius: '0.5rem',
              background: 'var(--primary)', color: 'var(--bg)',
              fontWeight: 600, fontSize: '0.9375rem',
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating || !propertyId || !inquiry.trim() ? 0.6 : 1,
            }}
          >
            {generating ? <Loader size={16} strokeWidth={1.5} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} strokeWidth={1.5} />}
            {generating ? 'Checking availability…' : 'Generate reply'}
          </button>
        </div>

        {/* Right: result */}
        {result && editedResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Availability status */}
            <div className="glass-card" style={{
              padding: '1.25rem',
              borderLeft: `3px solid ${result.is_available ? '#10b981' : '#ef4444'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {result.is_available
                  ? <Check size={16} strokeWidth={2} style={{ color: '#10b981' }} />
                  : <AlertCircle size={16} strokeWidth={1.5} style={{ color: '#ef4444' }} />}
                <p style={{ fontWeight: 500, color: result.is_available ? '#10b981' : '#ef4444' }}>
                  {result.is_available ? 'Available' : 'Not available'}
                </p>
              </div>
              {editedResult.needs_clarification && (
                <p style={{ fontSize: '0.8125rem', color: '#f59e0b' }}>
                  The AI needs clarification on some details — check the parsed fields below.
                </p>
              )}
            </div>

            {/* Parsed details — editable */}
            {result.is_available && (
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <p className="mono-accent" style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Parsed booking details</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

                  <div>
                    <label style={labelStyle}>Room type</label>
                    <input type="text" value={result.available_room_name ? `${result.parsed.matched_room_type_name} — Room ${result.available_room_name}` : ''} disabled style={{ ...inputStyle, opacity: 0.7 }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={labelStyle}>Check-in</label>
                      <input type="date" value={editedResult.check_in || ''} onChange={e => setEditedResult({ ...editedResult, check_in: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Check-out</label>
                      <input type="date" value={editedResult.check_out || ''} onChange={e => setEditedResult({ ...editedResult, check_out: e.target.value })} style={inputStyle} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={labelStyle}>Guests</label>
                      <input type="number" min={1} value={editedResult.pax} onChange={e => setEditedResult({ ...editedResult, pax: parseInt(e.target.value) || 1 })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Meal plan</label>
                      <select value={editedResult.meal_plan} onChange={e => setEditedResult({ ...editedResult, meal_plan: e.target.value as 'BB' | 'HB' | 'FB' })} style={inputStyle}>
                        {Object.entries(MEAL_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={labelStyle}>Guest name</label>
                    <input type="text" value={editedResult.guest_name || ''} onChange={e => setEditedResult({ ...editedResult, guest_name: e.target.value })} placeholder="Required to book" style={inputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Guest contact</label>
                    <input type="text" value={editedResult.guest_contact || ''} onChange={e => setEditedResult({ ...editedResult, guest_contact: e.target.value })} placeholder="Phone number (optional)" style={inputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Total amount (KES)</label>
                    <input type="number" min={0} value={editedResult.total_amount} onChange={e => setEditedResult({ ...editedResult, total_amount: parseFloat(e.target.value) || 0 })} style={inputStyle} />
                  </div>
                </div>
              </div>
            )}

            {/* Drafted reply */}
            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <p className="mono-accent" style={{ color: 'var(--primary)' }}>Drafted reply</p>
                <button
                  onClick={copyReply}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', color: copied ? '#10b981' : 'var(--text)', cursor: 'pointer', fontSize: '0.8125rem' }}
                >
                  {copied ? <Check size={13} strokeWidth={2} /> : <Copy size={13} strokeWidth={1.5} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div style={{ padding: '1rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', fontSize: '0.9375rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {result.reply_message}
              </div>
            </div>

            {/* Book it */}
            {result.is_available && (
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                {bookingSuccess ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', color: '#10b981', fontSize: '0.9375rem' }}>
                    <Check size={18} strokeWidth={2} />
                    {bookingSuccess}
                    <button onClick={() => navigate('/bookings')} style={{ marginLeft: 'auto', color: 'var(--primary)', background: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
                      View bookings →
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleBookIt}
                    disabled={booking || !canBook}
                    className="glow-border"
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      padding: '0.75rem', borderRadius: '0.5rem',
                      background: canBook ? 'var(--primary)' : 'var(--glass-bg)',
                      border: canBook ? 'none' : '1px solid var(--glass-border)',
                      color: canBook ? 'var(--bg)' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '0.9375rem',
                      cursor: booking || !canBook ? 'not-allowed' : 'pointer',
                      opacity: booking ? 0.7 : 1,
                    }}
                  >
                    <CalendarDays size={16} strokeWidth={1.5} />
                    {booking ? 'Creating booking…' : !canBook ? 'Enter guest name to book' : 'Book it'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AppLayout>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.875rem', marginBottom: '0.375rem', color: 'var(--text-secondary)' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '0.625rem 0.875rem', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '0.5rem', color: 'var(--text)', fontSize: '0.9375rem' }
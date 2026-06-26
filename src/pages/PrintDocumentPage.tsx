import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type DocType = 'confirmation' | 'invoice' | 'receipt'

interface BookingData {
  id: string
  guest_name: string
  guest_contact: string | null
  check_in: string
  check_out: string
  occupancy_type: string
  meal_plan: string
  pax: number
  total_amount: number
  status: string
  source: string
  notes: string | null
  created_at: string
  room_name: string
  room_type_name: string
  property_name: string
  property_logo: string | null
  property_currency: string
}

interface PaymentData {
  id: string
  amount: number
  payment_type: string
  discount_amount: number
  discount_pct: number
  notes: string | null
  recorded_at: string
}

const MEAL_LABELS: Record<string, string> = {
  BB: 'Bed & Breakfast',
  HB: 'Half Board',
  FB: 'Full Board',
}

const DOC_TITLES: Record<DocType, string> = {
  confirmation: 'Booking Confirmation',
  invoice: 'Invoice',
  receipt: 'Payment Receipt',
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })
}

function nightsBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function shortId(id: string) {
  return id.replace(/-/g, '').substring(0, 8).toUpperCase()
}

export function PrintDocumentPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const docType = (searchParams.get('doc') || 'confirmation') as DocType

  const [booking, setBooking] = useState<BookingData | null>(null)
  const [payments, setPayments] = useState<PaymentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) fetchData()
  }, [id])

  useEffect(() => {
    if (!loading && booking) {
      setTimeout(() => window.print(), 600)
    }
  }, [loading, booking])

  async function fetchData() {
    const [bookRes, payRes] = await Promise.all([
      supabase.from('bookings').select(`
        *,
        rooms (
          name,
          room_types ( name ),
          properties ( name, logo_url, currency )
        )
      `).eq('id', id!).single(),
      supabase.from('payments').select('*').eq('booking_id', id!).order('recorded_at'),
    ])

    if (bookRes.error) { setError(bookRes.error.message); setLoading(false); return }

    const b = bookRes.data as any
    setBooking({
      id: b.id,
      guest_name: b.guest_name,
      guest_contact: b.guest_contact,
      check_in: b.check_in,
      check_out: b.check_out,
      occupancy_type: b.occupancy_type,
      meal_plan: b.meal_plan,
      pax: b.pax,
      total_amount: Number(b.total_amount),
      status: b.status,
      source: b.source,
      notes: b.notes,
      created_at: b.created_at,
      room_name: b.rooms?.name || '—',
      room_type_name: b.rooms?.room_types?.name || '—',
      property_name: b.rooms?.properties?.name || '—',
      property_logo: b.rooms?.properties?.logo_url || null,
      property_currency: b.rooms?.properties?.currency || 'KES',
    })
    setPayments(payRes.data || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#374151' }}>
      Preparing document…
    </div>
  )

  if (error || !booking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif', color: '#ef4444' }}>
      {error || 'Booking not found.'}
    </div>
  )

  const nights = nightsBetween(booking.check_in, booking.check_out)
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount) - Number(p.discount_amount), 0)
  const balance = booking.total_amount - totalPaid
  const cur = booking.property_currency

  // Per-night rate (approximate — display only)
  const perNightRate = nights > 0 ? booking.total_amount / nights : 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #111827;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .page {
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 12mm 14mm;
          display: flex;
          flex-direction: column;
        }

        .header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 10mm;
          padding-bottom: 6mm;
          border-bottom: 2px solid #111827;
        }

        .logo-block {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-img {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 6px;
        }

        .logo-placeholder {
          width: 48px;
          height: 48px;
          border-radius: 6px;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 300;
          color: #6b7280;
        }

        .property-name {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .doc-meta {
          text-align: right;
        }

        .doc-title {
          font-size: 22px;
          font-weight: 300;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #111827;
        }

        .doc-ref {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: #6b7280;
          margin-top: 4px;
          letter-spacing: 0.08em;
        }

        .doc-date {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }

        .section {
          margin-bottom: 8mm;
        }

        .section-title {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #6b7280;
          margin-bottom: 3mm;
          padding-bottom: 1.5mm;
          border-bottom: 1px solid #e5e7eb;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6mm;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          padding: 2.5px 0;
          font-size: 13px;
          border-bottom: 1px solid #f3f4f6;
        }

        .detail-label {
          color: #6b7280;
          flex-shrink: 0;
          margin-right: 8px;
        }

        .detail-value {
          font-weight: 500;
          text-align: right;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .table th {
          text-align: left;
          padding: 5px 8px;
          background: #f9fafb;
          font-weight: 500;
          font-size: 12px;
          color: #374151;
          border: 1px solid #e5e7eb;
        }

        .table td {
          padding: 6px 8px;
          border: 1px solid #e5e7eb;
          vertical-align: top;
        }

        .table .right { text-align: right; }
        .table .mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }

        .totals {
          margin-top: 3mm;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .total-row {
          display: flex;
          gap: 24px;
          font-size: 13px;
          width: 220px;
          justify-content: space-between;
        }

        .total-row.grand {
          font-size: 15px;
          font-weight: 600;
          padding-top: 4px;
          border-top: 2px solid #111827;
          margin-top: 2px;
        }

        .total-row.paid {
          color: #059669;
        }

        .total-row.balance {
          color: #d97706;
        }

        .total-row.settled {
          color: #059669;
        }

        .status-badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          background: #dcfce7;
          color: #166534;
        }

        .notes-box {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          padding: 8px 12px;
          font-size: 13px;
          color: #374151;
          line-height: 1.5;
        }

        .footer {
          margin-top: auto;
          padding-top: 6mm;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #9ca3af;
        }

        .footer a { color: #9ca3af; }

        @media print {
          .no-print { display: none !important; }
          .page { padding: 10mm 12mm; }
          @page { size: A4; margin: 0; }
        }
      `}</style>

      {/* Screen-only print button */}
      <div className="no-print" style={{ position: 'fixed', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem', zIndex: 99 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '0.5rem 1.25rem', borderRadius: '0.5rem', background: '#111827', color: '#fff', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', border: 'none' }}
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: '0.5rem 1rem', borderRadius: '0.5rem', background: '#f3f4f6', color: '#374151', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', cursor: 'pointer', border: '1px solid #e5e7eb' }}
        >
          Close
        </button>
      </div>

      <div className="page">

        {/* Header */}
        <div className="header">
          <div className="logo-block">
            {booking.property_logo ? (
              <img src={booking.property_logo} alt={booking.property_name} className="logo-img" />
            ) : (
              <div className="logo-placeholder">{booking.property_name.charAt(0)}</div>
            )}
            <div>
              <div className="property-name">{booking.property_name}</div>
            </div>
          </div>
          <div className="doc-meta">
            <div className="doc-title">{DOC_TITLES[docType]}</div>
            <div className="doc-ref">REF: {shortId(booking.id)}</div>
            <div className="doc-date">
              {docType === 'receipt' ? 'Issued' : 'Date'}: {fmt(new Date().toISOString())}
            </div>
          </div>
        </div>

        {/* Guest + Stay info — all doc types */}
        <div className="grid-2 section">
          <div>
            <div className="section-title">Guest</div>
            <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{booking.guest_name}</span></div>
            {booking.guest_contact && <div className="detail-row"><span className="detail-label">Contact</span><span className="detail-value">{booking.guest_contact}</span></div>}
          </div>
          <div>
            <div className="section-title">Booking reference</div>
            <div className="detail-row"><span className="detail-label">Ref</span><span className="detail-value" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{shortId(booking.id)}</span></div>
            <div className="detail-row"><span className="detail-label">Status</span><span className="detail-value"><span className="status-badge">{booking.status.replace('_', ' ')}</span></span></div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">Stay details</div>
          <div className="grid-2">
            <div>
              <div className="detail-row"><span className="detail-label">Check-in</span><span className="detail-value">{fmt(booking.check_in)}</span></div>
              <div className="detail-row"><span className="detail-label">Check-out</span><span className="detail-value">{fmt(booking.check_out)}</span></div>
              <div className="detail-row"><span className="detail-label">Nights</span><span className="detail-value">{nights}</span></div>
            </div>
            <div>
              <div className="detail-row"><span className="detail-label">Room type</span><span className="detail-value">{booking.room_type_name}</span></div>
              <div className="detail-row"><span className="detail-label">Room</span><span className="detail-value">{booking.room_name}</span></div>
              <div className="detail-row"><span className="detail-label">Occupancy</span><span className="detail-value">{booking.occupancy_type.charAt(0).toUpperCase() + booking.occupancy_type.slice(1)}</span></div>
              <div className="detail-row"><span className="detail-label">Guests</span><span className="detail-value">{booking.pax}</span></div>
              <div className="detail-row"><span className="detail-label">Meal plan</span><span className="detail-value">{MEAL_LABELS[booking.meal_plan] || booking.meal_plan}</span></div>
            </div>
          </div>
        </div>

        {/* Invoice — itemised */}
        {docType === 'invoice' && (
          <div className="section">
            <div className="section-title">Charges</div>
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="right">Qty</th>
                  <th className="right">Unit rate ({cur})</th>
                  <th className="right">Amount ({cur})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{booking.room_type_name} — {MEAL_LABELS[booking.meal_plan]} ({booking.occupancy_type})</td>
                  <td className="right mono">{nights} night{nights !== 1 ? 's' : ''}</td>
                  <td className="right mono">{perNightRate.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                  <td className="right mono">{booking.total_amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
            <div className="totals">
              <div className="total-row grand">
                <span>Total</span>
                <span>{cur} {booking.total_amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation — just total */}
        {docType === 'confirmation' && (
          <div className="section">
            <div className="section-title">Amount</div>
            <div className="detail-row">
              <span className="detail-label">Total due</span>
              <span className="detail-value" style={{ fontSize: 16, fontWeight: 600 }}>{cur} {booking.total_amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {/* Receipt — payments breakdown */}
        {docType === 'receipt' && (
          <div className="section">
            <div className="section-title">Payments received</div>
            {payments.length === 0 ? (
              <p style={{ fontSize: 13, color: '#6b7280' }}>No payments recorded.</p>
            ) : (
              <>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Notes</th>
                      <th className="right">Amount ({cur})</th>
                      <th className="right">Discount ({cur})</th>
                      <th className="right">Net ({cur})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map(p => {
                      const net = Number(p.amount) - Number(p.discount_amount)
                      return (
                        <tr key={p.id}>
                          <td className="mono">{new Date(p.recorded_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td style={{ textTransform: 'capitalize' }}>{p.payment_type}</td>
                          <td style={{ color: '#6b7280' }}>{p.notes || '—'}</td>
                          <td className="right mono">{Number(p.amount).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                          <td className="right mono">{Number(p.discount_amount) > 0 ? Number(p.discount_amount).toLocaleString('en-KE', { minimumFractionDigits: 2 }) : '—'}</td>
                          <td className="right mono">{net.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="totals">
                  <div className="total-row">
                    <span>Total due</span>
                    <span>{cur} {booking.total_amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="total-row paid">
                    <span>Total paid</span>
                    <span>{cur} {totalPaid.toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`total-row grand ${balance <= 0 ? 'settled' : 'balance'}`}>
                    <span>{balance <= 0 ? 'Settled' : 'Balance due'}</span>
                    <span>{cur} {Math.abs(balance).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Notes */}
        {booking.notes && (
          <div className="section">
            <div className="section-title">Notes</div>
            <div className="notes-box">{booking.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div className="footer">
          <span>{booking.property_name}</span>
          <span>Powered by <a href="https://nex-chi-six.vercel.app">NexBookings</a> · Built by Jackson Mwaniki Munene</span>
        </div>
      </div>
    </>
  )
}
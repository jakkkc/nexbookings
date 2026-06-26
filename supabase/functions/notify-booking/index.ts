import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotifyPayload {
  booking_id: string
  property_id: string
  guest_name: string
  check_in: string
  check_out: string
  room_type_name: string
  room_name: string
  total_amount: number
  source: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Verify caller is authenticated ─────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Parse payload ───────────────────────────────────────
    const payload: NotifyPayload = await req.json()
    const { booking_id, property_id, guest_name, check_in, check_out, room_type_name, room_name, total_amount, source } = payload

    if (!booking_id || !property_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 3. Admin client to fetch staff emails ──────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get all staff assigned to this property + the owner
    const { data: assignments } = await adminClient
      .from('staff_assignments')
      .select('user_id')
      .eq('property_id', property_id)

    const { data: propertyRow } = await adminClient
      .from('properties')
      .select('name, account_id')
      .eq('id', property_id)
      .single()

    // Get owner of the account
    const { data: ownerRow } = await adminClient
      .from('users')
      .select('id, email, full_name')
      .eq('account_id', propertyRow?.account_id)
      .eq('role', 'owner')
      .single()

    // Get assigned staff emails
    const staffIds = (assignments || []).map((a: any) => a.user_id)
    const { data: staffUsers } = await adminClient
      .from('users')
      .select('email, full_name')
      .in('id', staffIds)

    // Build recipient list — owner + assigned staff, deduplicated
    const allRecipients = [
      ...(ownerRow ? [{ email: ownerRow.email, name: ownerRow.full_name || 'Owner' }] : []),
      ...(staffUsers || []).map((u: any) => ({ email: u.email, name: u.full_name || u.email })),
    ]
    const uniqueRecipients = allRecipients.filter(
      (r, i, arr) => arr.findIndex(x => x.email === r.email) === i
    )

    if (uniqueRecipients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No recipients found' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 4. Format email ────────────────────────────────────────
    const propertyName = propertyRow?.name || 'Your property'
    const nights = Math.round(
      (new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000
    )
    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })

    const isAI = source === 'whatsapp_ai'
    const subject = isAI
      ? `New AI booking — ${guest_name} — deposit needed`
      : `New booking confirmed — ${guest_name}`

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: Inter, -apple-system, sans-serif; background: #f9fafb; margin: 0; padding: 0; color: #111827; }
    .wrapper { max-width: 520px; margin: 2rem auto; background: #fff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; }
    .header { background: #111827; padding: 1.5rem 2rem; }
    .header h1 { color: #fff; font-size: 1.1rem; font-weight: 300; letter-spacing: 0.06em; margin: 0; }
    .header span { color: #90caf9; }
    .body { padding: 1.75rem 2rem; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.75rem; font-weight: 600; background: ${isAI ? '#fef3c7' : '#dcfce7'}; color: ${isAI ? '#92400e' : '#166534'}; margin-bottom: 1.25rem; }
    h2 { font-size: 1.25rem; font-weight: 400; margin: 0 0 0.375rem; }
    .sub { color: #6b7280; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .detail-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .detail-table td { padding: 0.5rem 0; border-bottom: 1px solid #f3f4f6; }
    .detail-table td:first-child { color: #6b7280; width: 40%; }
    .detail-table td:last-child { font-weight: 500; }
    .amount { font-size: 1.25rem; font-weight: 600; color: #111827; }
    .cta { display: inline-block; margin-top: 1rem; padding: 0.75rem 1.5rem; background: #111827; color: #fff; border-radius: 6px; text-decoration: none; font-size: 0.875rem; font-weight: 500; }
    ${isAI ? '.alert { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 0.875rem 1rem; font-size: 0.875rem; color: #92400e; margin-bottom: 1.5rem; }' : ''}
    .footer { padding: 1rem 2rem; background: #f9fafb; border-top: 1px solid #e5e7eb; font-size: 0.75rem; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Nex<span>Bookings</span></h1>
    </div>
    <div class="body">
      <div class="badge">${isAI ? '🤖 AI booking' : '✓ New booking'}</div>
      <h2>${guest_name}</h2>
      <p class="sub">${propertyName}</p>
      ${isAI ? `<div class="alert">This booking was created by the AI assistant. Please follow up with the guest to collect a deposit.</div>` : ''}
      <table class="detail-table">
        <tr><td>Room type</td><td>${room_type_name}</td></tr>
        <tr><td>Room</td><td>${room_name}</td></tr>
        <tr><td>Check-in</td><td>${fmtDate(check_in)}</td></tr>
        <tr><td>Check-out</td><td>${fmtDate(check_out)}</td></tr>
        <tr><td>Nights</td><td>${nights}</td></tr>
        <tr><td>Total</td><td class="amount">KES ${Number(total_amount).toLocaleString()}</td></tr>
      </table>
      <a href="${Deno.env.get('SITE_URL') || 'https://nexbookings.vercel.app'}/bookings/${booking_id}" class="cta">
        View booking →
      </a>
    </div>
    <div class="footer">
      Sent by NexBookings · Built by Jackson Mwaniki Munene
    </div>
  </div>
</body>
</html>`

    // ── 5. Send via Resend ─────────────────────────────────────
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const sendResults = await Promise.all(
      uniqueRecipients.map(recipient =>
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'NexBookings <onboarding@resend.dev>',
            to: [recipient.email],
            subject,
            html: emailHtml,
          }),
        }).then(r => r.json())
      )
    )

    return new Response(
      JSON.stringify({ success: true, sent: sendResults.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('notify-booking error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
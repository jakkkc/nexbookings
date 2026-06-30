import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestPayload {
  property_id: string
  inquiry_text: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { property_id, inquiry_text }: RequestPayload = await req.json()
    if (!property_id || !inquiry_text?.trim()) {
      return new Response(JSON.stringify({ error: 'Missing property_id or inquiry_text' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Fetch property + room types ───────────────────────────
    const { data: property } = await adminClient
      .from('properties')
      .select('name, currency')
      .eq('id', property_id)
      .single()

    const { data: roomTypes } = await adminClient
      .from('room_types')
      .select('id, name, max_pax, prices')
      .eq('property_id', property_id)

    if (!property || !roomTypes || roomTypes.length === 0) {
      return new Response(JSON.stringify({ error: 'No room types found for this property' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Fetch rooms per type ──────────────────────────────────
    const { data: rooms } = await adminClient
      .from('rooms')
      .select('id, name, room_type_id')
      .eq('property_id', property_id)

    // ── Fetch existing active bookings for availability check ──
    const { data: existingBookings } = await adminClient
      .from('room_bookings_view')
      .select('room_id, check_in, check_out')
      .in('room_id', (rooms || []).map((r: any) => r.id))

    const today = new Date().toISOString().split('T')[0]

    // ── Build context for the AI ───────────────────────────────
    const roomTypesContext = roomTypes.map((rt: any) => ({
      id: rt.id,
      name: rt.name,
      max_pax: rt.max_pax,
      prices: rt.prices,
      room_count: (rooms || []).filter((r: any) => r.room_type_id === rt.id).length,
    }))

    const systemPrompt = `You are a booking assistant for "${property.name}", a property in Kenya. Currency is ${property.currency}.

You will receive a guest inquiry message. It may be in English, Swahili, Sheng (Kenyan slang), broken English, or a mix of all three — understand it regardless of grammar or spelling. Kenyan guests often write casually, e.g. "niaje, kuna room ya watu wawili weekend hii?" or "good day, am inquiring if u have vacancy for 3 ppl frm 15th to 18th aug, na bnb tu".

Today's date is ${today}. Resolve relative dates (e.g. "this weekend", "next Friday", "kesho", "wiki ijayo") based on today's date.

Available room types at this property:
${JSON.stringify(roomTypesContext, null, 2)}

Pricing structure per room type: prices.single/double/extra_pax each have bb/hb/fb rates per night. "extra_pax" rate applies per guest beyond 2 (for family-sized rooms).

Your task:
1. Parse the inquiry: check_in date (YYYY-MM-DD), check_out date (YYYY-MM-DD), number of guests (pax), meal plan (BB=bed&breakfast/HB=half board/FB=full board, default BB if not mentioned), and guest name/contact if mentioned.
2. Pick the best matching room type for the pax count (smallest room type that fits the pax, respecting max_pax).
3. Calculate total price: nights × (base rate for single/double occupancy + extra_pax rate × any guests beyond 2), based on meal plan.
4. Determine occupancy_type: "single" if pax=1, otherwise "double" (extra_pax pricing handles 3+).
5. Write a warm, natural, human-sounding reply message in the SAME language/style the guest used (if they wrote in Swahili/Sheng, reply in Swahili/Sheng; if English, reply in English). The reply should mention the room type, price, and ask if they'd like to confirm. If dates are missing/unclear, ask for clarification instead of guessing.

Respond ONLY with valid JSON, no markdown, no preamble, in this exact shape:
{
  "parsed": {
    "check_in": "YYYY-MM-DD or null",
    "check_out": "YYYY-MM-DD or null",
    "pax": number,
    "meal_plan": "BB" | "HB" | "FB",
    "occupancy_type": "single" | "double",
    "guest_name": "string or null",
    "guest_contact": "string or null",
    "matched_room_type_id": "uuid or null",
    "matched_room_type_name": "string or null",
    "nights": number,
    "total_amount": number,
    "needs_clarification": boolean
  },
  "reply_message": "the drafted guest-facing reply"
}`

    // ── Call Groq ────────────────────────────────────────────
    const groqKey = Deno.env.get('GROQ_API_KEY')
    if (!groqKey) {
      return new Response(JSON.stringify({ error: 'GROQ_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: inquiry_text },
        ],
        temperature: 0.4,
        response_format: { type: 'json_object' },
      }),
    })

    if (!groqRes.ok) {
      const errText = await groqRes.text()
      console.error('Groq error:', errText)
      return new Response(JSON.stringify({ error: 'AI service error', detail: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const groqData = await groqRes.json()
    const content = groqData.choices?.[0]?.message?.content

    if (!content) {
      return new Response(JSON.stringify({ error: 'No response from AI' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response', raw: content }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Check actual availability for the matched room type ────
    let availableRoomId: string | null = null
    let availableRoomName: string | null = null

    if (parsed.parsed?.matched_room_type_id && parsed.parsed?.check_in && parsed.parsed?.check_out) {
      const typeRooms = (rooms || []).filter((r: any) => r.room_type_id === parsed.parsed.matched_room_type_id)
      const checkIn = parsed.parsed.check_in
      const checkOut = parsed.parsed.check_out

      const bookedRoomIds = new Set(
        (existingBookings || [])
          .filter((b: any) => b.check_in < checkOut && b.check_out > checkIn)
          .map((b: any) => b.room_id)
      )

      const freeRoom = typeRooms.find((r: any) => !bookedRoomIds.has(r.id))
      if (freeRoom) {
        availableRoomId = freeRoom.id
        availableRoomName = freeRoom.name
      }
    }

    return new Response(
      JSON.stringify({
        ...parsed,
        available_room_id: availableRoomId,
        available_room_name: availableRoomName,
        is_available: !!availableRoomId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('ai-reply error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
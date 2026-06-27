import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InvitePayload {
  email: string
  full_name: string
  role: 'manager' | 'receptionist'
  property_ids: string[]
  account_id: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // ── 1. Verify the caller is authenticated ─────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Client with caller's JWT — used only to verify who they are
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: authError } = await callerClient.auth.getUser()
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. Parse and validate the payload ────────────────────
    const payload: InvitePayload = await req.json()
    const { email, full_name, role, property_ids, account_id } = payload

    if (!email || !role || !account_id || !property_ids?.length) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!['manager', 'receptionist'].includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role. Only manager or receptionist allowed.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 3. Service role client — bypasses RLS ─────────────────
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── 4. Confirm caller is an owner in that account ─────────
    const { data: callerUser, error: callerError } = await adminClient
      .from('users')
      .select('role, account_id')
      .eq('id', caller.id)
      .single()

    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: 'Could not verify caller identity' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (callerUser.account_id !== account_id) {
      return new Response(JSON.stringify({ error: 'You can only invite staff to your own account' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!['owner', 'super_admin'].includes(callerUser.role)) {
      return new Response(JSON.stringify({ error: 'Only owners can invite staff' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 5. Verify all property_ids belong to the account ─────
    if (property_ids.length > 0) {
      const { data: ownedProps, error: propError } = await adminClient
        .from('properties')
        .select('id')
        .eq('account_id', account_id)
        .in('id', property_ids)

      if (propError || !ownedProps || ownedProps.length !== property_ids.length) {
        return new Response(JSON.stringify({ error: 'One or more properties do not belong to your account' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // ── 6. Create the auth user with metadata ─────────────────
    const tempPassword = crypto.randomUUID()

    const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        account_id,
        role,
        full_name: full_name || '',
      },
    })

    if (createError || !newAuthUser?.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'Failed to create user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 7. Create staff_assignments ───────────────────────────
    if (property_ids.length > 0) {
      const assignments = property_ids.map((property_id: string) => ({
        user_id: newAuthUser.user.id,
        property_id,
      }))

      const { error: assignError } = await adminClient
        .from('staff_assignments')
        .insert(assignments)

      if (assignError) {
        console.error('staff_assignments insert failed:', assignError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newAuthUser.user.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('invite-staff error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
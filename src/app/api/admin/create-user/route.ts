import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Step 1: confirm the person calling this is actually a logged-in admin.
  // We never trust the front-end alone for this check.
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

const { data: callerProfile, error: callerError } = await supabaseAdmin    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  console.log('SERVER: user.id =', user.id)
  console.log('SERVER: callerProfile =', callerProfile)
  console.log('SERVER: callerError =', callerError)

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  // Step 2: create the new account using the secret key (server-only).
  const body = await request.json()
  const { email, password, role, playerId } = body

  if (!email || !password || !role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    return NextResponse.json({ error: createError.message }, { status: 400 })
  }

  // Step 3: link the new account to a role + optional player record.
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: newUser.user.id,
      role,
      player_id: playerId || null,
    })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, userId: newUser.user.id })
}
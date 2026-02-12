import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { email, tripId, name, golferId } = await req.json() // Expect golferId now

    if (!email || !tripId || !golferId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // 1. Send the Invite (Supabase handles "New" vs "Existing" logic mostly)
    // If they are new, this creates a user in auth.users with "invited" state
    const { data: userData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/trip?id=${tripId}`
    })

    if (inviteError) {
      console.error('Invite Error:', inviteError)
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    // 2. CRITICAL: Link the Auth User ID to the Trip Golfer Row immediately
    if (userData.user) {
      const { error: updateError } = await supabaseAdmin
        .from('trip_golfers')
        .update({ 
          user_id: userData.user.id,
          email: email // Ensure email is synced
        })
        .eq('id', golferId) // Update the specific golfer row we clicked "Invite" on

      if (updateError) throw updateError
    }

    return NextResponse.json({ success: true, message: 'Invite sent and profile linked.' })

  } catch (err: any) {
    console.error('Server Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: Request) {
  // 1. Init "God Mode" Admin Client
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { email, tripId, name, golferId, tripName } = await req.json()

    if (!email || !tripId || !golferId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // We must route through /auth/callback to exchange the token for a session
    const nextPath = `/trip?id=${tripId}`
    const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPath)}`

    // --- SMART LINK GENERATION ---
    let action_link = ''
    let user_id = ''

    // 2. Try to generate an 'invite' link (Works for NEW users)
    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: redirectUrl,
        data: { full_name: name }
      }
    })

    if (!inviteError && inviteData.properties?.action_link) {
      // Success: It's a new user
      action_link = inviteData.properties.action_link
      user_id = inviteData.user.id
    } else {
      // 3. Fallback: If 'invite' failed, assume Existing User and try 'magiclink'
      console.log(`Invite failed (likely existing user), falling back to magic link for ${email}`)
      
      const { data: magicData, error: magicError } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: { redirectTo: redirectUrl }
      })

      if (magicError || !magicData.properties?.action_link) {
        return NextResponse.json({ error: magicError?.message || 'Failed to generate link' }, { status: 500 })
      }

      action_link = magicData.properties.action_link
      user_id = magicData.user.id
    }

    // 4. Link the Golfer Row AND set Status to 'invited'
    // We do this regardless of new/existing user so they see the UI update
    if (user_id) {
      const { error: updateError } = await supabaseAdmin
        .from('trip_golfers')
        .update({ 
          user_id: user_id,
          email: email,
          status: 'invited'
        })
        .eq('id', golferId)

      if (updateError) throw updateError
    }

    // 5. Send the Custom Email via Resend
    const { error: emailError } = await resend.emails.send({
      from: 'GolfTripHQ <trips@golftriphq.com>', 
      to: [email],
      subject: `You're invited to ${tripName || 'a Golf Trip'}!`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h1 style="color: #1a4d2e; margin-bottom: 16px;">You're going on a golf trip! ⛳️</h1>
          <p style="font-size: 16px; color: #374151; line-height: 1.5;">
            You have been added to the roster for <strong>${tripName || 'an upcoming trip'}</strong>.
          </p>
          <p style="font-size: 16px; color: #374151; line-height: 1.5; margin-bottom: 24px;">
            Click the button below to accept your invite and view the itinerary.
          </p>
          <a href="${action_link}" style="display: inline-block; background-color: #d4af37; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Join Trip
          </a>
          <p style="color: #6b7280; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            If the button doesn't work, copy this link: <br/>
            <a href="${action_link}" style="color: #1a4d2e;">${action_link}</a>
          </p>
        </div>
      `
    })

    if (emailError) {
      console.error('Resend Error:', emailError)
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Invite sent via Resend' })

  } catch (err: any) {
    console.error('Server Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
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

    // 2. Generate the Invite Link (Handles both New and Existing users automatically)
    // We use 'invite' type which creates a user if they don't exist
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/trip?id=${tripId}`,
        data: { full_name: name } // Stores name in metadata if new user
      }
    })

    if (linkError) {
      console.error('Link Generation Error:', linkError)
      return NextResponse.json({ error: linkError.message }, { status: 500 })
    }

    const { user, properties } = linkData
    const action_link = properties?.action_link

    if (!action_link) {
      return NextResponse.json({ error: 'Failed to generate action link' }, { status: 500 })
    }

    // 3. Link the Golfer Row AND set Status to 'invited'
    if (user) {
      const { error: updateError } = await supabaseAdmin
        .from('trip_golfers')
        .update({ 
          user_id: user.id,
          email: email,
          status: 'invited' // <--- Mark as Pending
        })
        .eq('id', golferId)

      if (updateError) throw updateError
    }

    // 4. Send the Custom Email via Resend
    // NOTE: Using your verified domain. If this fails, switch back to 'onboarding@resend.dev'
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
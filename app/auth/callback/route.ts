import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { type CookieOptions, createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // 1. Capture the original destination (which holds the trip creation params)
  // Default to /dashboard if nothing is there
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  
  // 2. Check for basic Supabase Errors
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  if (error || errorDescription) {
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/auth-code-error?e=${encodeURIComponent(errorDescription || error || 'Unknown Error')}&next=${encodeURIComponent(next)}`
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }) },
          remove(name: string, options: CookieOptions) { cookieStore.delete({ name, ...options }) },
        },
      }
    )
    
    // 3. Attempt to Exchange Code for Session
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!sessionError) {
      // SUCCESS! Redirect to the intended destination (e.g. /dashboard?tripName=...)
      return NextResponse.redirect(`${requestUrl.origin}${next}`)
    } 

    // 4. SPECIAL HANDLING: Catch the "PKCE code verifier" error
    if (sessionError.message.includes("code verifier")) {
        console.error("PKCE Conflict Detected (Clean your cookies):", sessionError)
        
        // Pass the 'next' param so the retry link works
        return NextResponse.redirect(
            `${requestUrl.origin}/auth/auth-code-error?e=${encodeURIComponent("Browser conflict detected. Please close this tab and click the email invite link one more time.")}&next=${encodeURIComponent(next)}`
        )
    }

    // 5. Handle other real errors
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/auth-code-error?e=${encodeURIComponent(sessionError.message)}&next=${encodeURIComponent(next)}`
    )
  }

  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?e=NoCodeProvided&next=${encodeURIComponent(next)}`)
}
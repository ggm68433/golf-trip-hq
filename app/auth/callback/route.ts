import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { type CookieOptions, createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  // Default to /trip if no 'next' param is provided
  const next = requestUrl.searchParams.get('next') ?? '/trip'
  
  // 1. Check for basic Supabase Errors
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')
  if (error || errorDescription) {
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/auth-code-error?e=${encodeURIComponent(errorDescription || error || 'Unknown Error')}`
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
    
    // 2. Attempt to Exchange Code for Session
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!sessionError) {
      // SUCCESS! Redirect to the intended destination (e.g., the trip page)
      return NextResponse.redirect(`${requestUrl.origin}${next}`)
    } 

    // 3. SPECIAL HANDLING: Catch the "PKCE code verifier" error
    // This happens when you have leftover cookies from a different login attempt.
    if (sessionError.message.includes("code verifier")) {
        console.error("PKCE Conflict Detected (Clean your cookies):", sessionError)
        
        // We redirect to the error page, but with a specific instruction.
        // Usually, simply clicking the link a second time works because the first attempt cleared the bad cookie.
        return NextResponse.redirect(
            `${requestUrl.origin}/auth/auth-code-error?e=${encodeURIComponent("Browser conflict detected. Please close this tab and click the email invite link one more time.")}`
        )
    }

    // 4. Handle other real errors
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/auth-code-error?e=${encodeURIComponent(sessionError.message)}`
    )
  }

  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?e=NoCodeProvided`)
}
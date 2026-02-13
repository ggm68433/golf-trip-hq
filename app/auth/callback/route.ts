import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { type CookieOptions, createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'
  
  // 1. Check for Supabase Errors (e.g. "Token expired", "Invalid token")
  const error = requestUrl.searchParams.get('error')
  const errorDescription = requestUrl.searchParams.get('error_description')

  if (error || errorDescription) {
    console.error('Supabase Auth Error:', error, errorDescription)
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/auth-code-error?e=${encodeURIComponent(errorDescription || error || 'Unknown Supabase Error')}`
    )
  }

  // 2. If we have a code, exchange it
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
    
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!sessionError) {
      // SUCCESS: Login complete, go to destination
      return NextResponse.redirect(`${requestUrl.origin}${next}`)
    } else {
      // Exchange failed
      console.error("Session Exchange Error:", sessionError)
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/auth-code-error?e=${encodeURIComponent(sessionError.message)}`
      )
    }
  }

  // 3. Fallback: No code and No error? (This is the mysterious "NoCodeProvided" case)
  // We'll log the full URL params to see what IS there.
  console.error("No Code/Error found. Params:", Object.fromEntries(requestUrl.searchParams))
  return NextResponse.redirect(`${requestUrl.origin}/auth/auth-code-error?e=NoCodeProvided_CheckLogs`)
}
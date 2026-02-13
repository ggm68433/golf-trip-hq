'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

function ErrorContent() {
  const searchParams = useSearchParams()
  const errorMsg = searchParams.get('e') || ''
  const isCrossDeviceError = errorMsg.includes('code verifier') || errorMsg.includes('PKCE')
  
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Resend the signup confirmation (or magic link)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`
      }
    })

    setLoading(false)
    if (error) {
      alert(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9fbf9] p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
        
        {/* CASE 1: CROSS DEVICE FIXER */}
        {isCrossDeviceError && !sent ? (
          <div>
             <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-amber-500 text-3xl">devices</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">New Device Detected</h1>
            <p className="text-slate-500 mb-6 text-sm leading-relaxed">
              For your security, links must be opened on the same device that requested them.
            </p>
            <div className="bg-slate-50 p-4 rounded-xl mb-6">
              <p className="text-slate-900 font-bold text-sm mb-2">Finish signing up on this device:</p>
              <form onSubmit={handleResend} className="flex flex-col gap-3">
                <input 
                  type="email" 
                  placeholder="Confirm your email address" 
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a4d2e] outline-none"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22] disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Sending...' : 'Send New Link'}
                </button>
              </form>
            </div>
            <Link href="/" className="text-xs text-slate-400 hover:text-slate-600">
              Return Home
            </Link>
          </div>
        ) : (
          /* CASE 2: STANDARD ERROR (OR SUCCESS MESSAGE) */
          <div>
            {sent ? (
              <>
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-green-600 text-3xl">mark_email_read</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h1>
                <p className="text-slate-500 mb-6">
                  We sent a fresh link to <strong>{email}</strong>. <br/>
                  Click it on <u>this device</u> to finish.
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="material-symbols-outlined text-red-500 text-3xl">error_outline</span>
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Login Failed</h1>
                <p className="text-slate-500 mb-6">We couldn't verify your login link.</p>
                {errorMsg && (
                  <div className="bg-red-50 border border-red-100 text-red-700 p-3 rounded-lg text-xs font-mono mb-6 break-words text-left">
                    Error: {errorMsg}
                  </div>
                )}
              </>
            )}
            <Link href="/" className="inline-flex items-center justify-center w-full py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
              Return Home
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  )
}
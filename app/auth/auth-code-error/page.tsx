'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

function ErrorContent() {
  const searchParams = useSearchParams()
  const errorMsg = searchParams.get('e') || 'Unknown error occurred'
  
  // State for the recovery form
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

    // We use signInWithOtp which acts as a "Magic Link" generator
    // This works for both new users (Sign Up) and existing users (Sign In)
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`
      }
    })

    setLoading(false)
    if (error) {
      alert(`Error: ${error.message}`)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9fbf9] p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
        
        {/* HEADER ICON */}
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${sent ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-500'}`}>
          <span className="material-symbols-outlined text-3xl">
            {sent ? 'mark_email_read' : 'link_off'}
          </span>
        </div>

        {sent ? (
          // SUCCESS STATE
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Sent!</h1>
            <p className="text-slate-500 mb-6">
              We sent a fresh login link to <strong>{email}</strong>. <br/>
              Click it on <u>this device</u> to finish.
            </p>
            <Link href="/" className="inline-flex items-center justify-center w-full py-3 px-4 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
              Return Home
            </Link>
          </>
        ) : (
          // ERROR + FORM STATE
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Login Link Issue</h1>
            <p className="text-slate-500 mb-4 text-sm">
              Your link may have expired or was opened on a different device.
            </p>

            {/* ERROR DEBUGGER (Small) */}
            <div className="bg-red-50 text-red-600 p-2 rounded text-xs font-mono mb-6 break-words border border-red-100">
              {errorMsg}
            </div>

            {/* RECOVERY FORM - ALWAYS VISIBLE */}
            <div className="bg-slate-50 p-5 rounded-xl text-left border border-slate-100">
              <label className="text-slate-900 font-bold text-sm mb-2 block">
                Send a new link to this device:
              </label>
              <form onSubmit={handleResend} className="flex flex-col gap-3">
                <input 
                  type="email" 
                  placeholder="name@example.com" 
                  className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#1a4d2e] outline-none"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22] disabled:opacity-50 transition-colors shadow-sm"
                >
                  {loading ? 'Sending...' : 'Send Magic Link'}
                </button>
              </form>
            </div>
            
            <div className="mt-6">
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 font-medium">
                Return to Home Page
              </Link>
            </div>
          </>
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
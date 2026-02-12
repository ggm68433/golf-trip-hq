'use client'

import Link from 'next/link'

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f9fbf9] p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="material-symbols-outlined text-red-500 text-3xl">error_outline</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Login Failed</h1>
        <p className="text-slate-500 mb-8">
          We couldn't verify your login link. It may have expired or been used already.
        </p>
        <Link 
          href="/" 
          className="inline-flex items-center justify-center w-full py-3 px-4 bg-[#1a4d2e] text-white font-bold rounded-xl hover:bg-[#0d2818] transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
}
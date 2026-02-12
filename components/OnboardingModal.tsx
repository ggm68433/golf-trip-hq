'use client'

import { useState } from 'react'
// 1. CHANGE THIS IMPORT
import { createBrowserClient } from '@supabase/ssr' 

interface Props {
  userId: string
  onComplete: () => void
}

export default function OnboardingModal({ userId, onComplete }: Props) {
  // 2. INITIALIZE CLIENT INSIDE THE COMPONENT
  // This ensures it has access to the latest browser cookies
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [fullName, setFullName] = useState('')
  const [handicap, setHandicap] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) return alert('Please enter your full name')

    setLoading(true)

    // Ensure numeric or null
    const handicapValue = handicap !== '' ? parseFloat(handicap) : null

    // 1. Update Profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: fullName,
        handicap: handicapValue,
        updated_at: new Date().toISOString(),
      })

    if (profileError) {
      console.error('Error saving profile:', profileError)
      alert('Failed to save profile. Please try again.')
      setLoading(false)
      return
    }

    // 2. Sync to Trip Golfers
    if (handicapValue !== null) {
      // NOTE: We wrap this in a try/catch or simple error log because
      // if the user isn't in a trip yet, this update is expected to yield 0 rows.
      const { error: rosterError } = await supabase
        .from('trip_golfers')
        .update({ 
          handicap: handicapValue,
          name: fullName 
        })
        .eq('user_id', userId)
        
       if (rosterError) console.warn("Roster sync skipped (user likely not in a trip yet)")
    }

    setLoading(false)
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans text-[#111814]">
      {/* Background with Blur */}
      <div 
        className="fixed inset-0 bg-[#f6f8f6] opacity-95" 
        style={{ backgroundImage: `url('https://www.transparenttextures.com/patterns/cubes.png')` }}
      ></div>
      <div className="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-[560px] bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-[fadeInUp_0.4s_ease-out]">
        
        {/* Header Image */}
        <div 
          className="h-32 w-full bg-cover bg-center relative" 
          style={{ backgroundImage: `url('https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?q=80&w=2070&auto=format&fit=crop')` }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a3c26]/90 to-transparent"></div>
          
          {/* --- SERVER-SIDE SIGN OUT FORM --- */}
          <form action="/auth/signout" method="post">
            <button 
              type="submit"
              className="absolute top-4 right-4 z-10 text-white/90 hover:text-white text-xs font-bold uppercase tracking-wider bg-black/30 hover:bg-black/50 px-4 py-2 rounded-full transition-all backdrop-blur-md border border-white/10 shadow-sm"
            >
              Sign Out
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-8">
          
          {/* Progress & Title */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Profile Setup</span>
              <span>Step 1 of 1</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#d4af37] w-full rounded-full"></div>
            </div>
            <div className="space-y-1 pt-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1a3c26]">Your Golfer Profile</h2>
              <p className="text-slate-500 text-base">Let's get the basics down to personalize your trip.</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Name Input */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-[#0d2818]" htmlFor="fullName">
                <span className="material-symbols-outlined text-[18px] text-[#d4af37]">person</span>
                Full Name
              </label>
              <input 
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-12 px-4 rounded-lg bg-[#f6f8f6] border border-slate-200 text-[#0d2818] font-medium placeholder:text-slate-400 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] outline-none transition-all"
                placeholder="e.g. Tiger Woods"
                autoFocus
              />
            </div>

            {/* Handicap Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-bold text-[#0d2818]" htmlFor="handicap">
                  <span className="material-symbols-outlined text-[18px] text-[#d4af37]">golf_course</span>
                  Current Handicap <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <span className="text-xs text-slate-400 font-medium bg-slate-100 px-2 py-0.5 rounded">GHIN or Est.</span>
              </div>
              <input 
                id="handicap"
                type="number"
                step="0.1"
                value={handicap}
                onChange={(e) => setHandicap(e.target.value)}
                className="w-full h-12 px-4 rounded-lg bg-[#f6f8f6] border border-slate-200 text-[#0d2818] font-medium placeholder:text-slate-400 focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] outline-none transition-all"
                placeholder="e.g. 12.5"
              />
            </div>

            {/* Save Button */}
            <div className="pt-4">
              <button 
                type="submit" 
                disabled={loading}
                className="w-full h-12 bg-[#1a3c26] hover:bg-[#122a1b] text-white font-bold rounded-lg shadow-lg shadow-[#1a3c26]/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                <span>{loading ? 'Saving...' : 'Save & Continue to Trip'}</span>
                {!loading && <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform text-sm">arrow_forward</span>}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  )
}
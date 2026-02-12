'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr' // ADD THIS
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function LandingPage() {
  
  // --- TRIP CREATION STATE ---
  const [location, setLocation] = useState('')
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);
  const [startDate, endDate] = dateRange;
  const [email, setEmail] = useState('')
  
  // --- SIGN IN STATE ---
  const [showSignIn, setShowSignIn] = useState(false)
  const [signInEmail, setSignInEmail] = useState('')
  const [signInStep, setSignInStep] = useState(1) // 1 = Input, 2 = Success

  // --- SHARED UI STATE ---
  const [currentStep, setCurrentStep] = useState(1) // 1 = Landing Hero, 2 = Trip Confirm Modal
  const [loading, setLoading] = useState(false)

  // ---------------------------------------------------------
  // ACTION: START PLANNING (Create Trip)
  // ---------------------------------------------------------
  const handleStartPlanning = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault()
    
    if (!location) return alert('Please enter a destination')
    if (!startDate) return alert('Please select dates')
    if (!email) return alert('Please enter your email')
    
    setLoading(true)
    
    // FIX: Construct the URL manually to ensure it handles special characters in location correctly
    // We pass the trip details in the 'next' parameter so the Dashboard can read them immediately
    const nextUrl = `/dashboard?tripName=${encodeURIComponent(location)}&start=${startDate.toISOString()}&end=${endDate ? endDate.toISOString() : ''}`
    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`

    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        emailRedirectTo: redirectUrl, // <--- THIS WAS MISSING
        data: {
          location: location,
          start_date: startDate ? startDate.toISOString() : null,
          end_date: endDate ? endDate.toISOString() : null
        }
      }
    })
    
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      setCurrentStep(2)
    }
  }

  // ---------------------------------------------------------
  // ACTION: SIGN IN (Existing User)
  // ---------------------------------------------------------
  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!signInEmail) return alert('Please enter your email')

    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ 
      email: signInEmail,
      options: {
        // FIX: Point existing users to the callback (defaults to /dashboard)
        emailRedirectTo: `${window.location.origin}/auth/callback` 
      }
    })
    setLoading(false)

    if (error) {
      alert(error.message)
    } else {
      setSignInStep(2)
    }
  }

// Resend Logic
  const handleResend = async (targetEmail: string) => {
    setLoading(true)
    
    // capture the error object
    const { error } = await supabase.auth.signInWithOtp({ 
      email: targetEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    })
    
    setLoading(false)

    // CHECK for the error before celebrating
    if (error) {
      alert(`Error: ${error.message}`) // This will likely say "Rate limit exceeded"
    } else {
      alert(`Magic link resent to ${targetEmail}`)
    }
  }

  // Edit Email Logic
  const handleEditEmail = () => {
    setCurrentStep(1)
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-[#111814] bg-[#f9fbf9] overflow-x-hidden">
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>

      {/* DatePicker Overrides */}
      <style jsx global>{`
        .react-datepicker-wrapper { width: 100%; }
        .react-datepicker__input-container input {
           width: 100%; background: transparent; border: none;
           padding: 12px 12px 12px 40px; font-size: 1rem; color: #0d2818; outline: none;
        }
        .react-datepicker__input-container input:focus { box-shadow: none; border-color: #d4af37; }
        .react-datepicker__header { background-color: #f9fbf9; border-bottom: 1px solid #e5e7eb; }
        .react-datepicker__day--selected, .react-datepicker__day--in-range {
           background-color: #1a4d2e !important; color: white !important;
        }
        .react-datepicker__day--keyboard-selected {
           background-color: #d4af37 !important; color: black !important;
        }
      `}</style>

      {/* --- HEADER --- */}
      <header className="fixed top-0 z-40 w-full transition-all duration-300 bg-[#0d2818]/90 backdrop-blur-md border-b border-white/10 px-4 py-4 sm:px-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-[#D4AF37] flex items-center justify-center p-1.5 rounded-full bg-white/5 border border-white/10">
              <span className="material-symbols-outlined text-2xl">sports_golf</span>
            </div>
            <h2 className="text-white text-xl font-bold leading-tight tracking-tight font-display">
              GolfTrip<span className="text-[#D4AF37]">HQ</span>
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                setShowSignIn(true)
                setSignInStep(1)
              }}
              className="flex items-center gap-2 cursor-pointer rounded-full h-10 px-5 bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 hover:border-white/30 transition-all"
            >
              <span className="hidden sm:inline">Sign In</span>
              <span className="material-symbols-outlined text-[18px]">login</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center w-full relative">
        
        {/* --- HERO SECTION --- */}
        <div 
          className="relative w-full flex flex-col items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat p-4 sm:p-8" 
          style={{ backgroundImage: `linear-gradient(rgba(13, 40, 24, 0.5), rgba(13, 40, 24, 0.7)), url('https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?q=80&w=2070&auto=format&fit=crop')` }}
        >
          <div className="absolute inset-0 bg-[#0d2818]/30 backdrop-blur-[2px]"></div>
          
          <div className="relative z-10 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center h-full pt-20">
            {/* Left Copy */}
            <div className="flex flex-col gap-6 text-center lg:text-left order-2 lg:order-1">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#D4AF37]/20 backdrop-blur-sm border border-[#D4AF37]/40 text-[#e5c558] font-bold text-xs uppercase tracking-widest w-fit mx-auto lg:mx-0">
                <span className="material-symbols-outlined text-sm">workspace_premium</span> Premium Golf Experiences
              </span>
              <h1 className="text-white text-4xl sm:text-6xl font-black leading-tight tracking-tight drop-shadow-xl font-display">
                Craft Your Perfect <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D4AF37] to-[#e5c558]">Golf Getaway</span>
              </h1>
            </div>

            {/* Right Form Panel (Create Trip) */}
            <div id="planning-form" className="order-1 lg:order-2 w-full flex justify-center lg:justify-end">
              <div className="w-full max-w-md rounded-2xl shadow-2xl border-t border-white/40 overflow-hidden relative" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)' }}>
                <div className="h-1.5 w-full bg-gray-200 flex">
                  <div className="w-1/2 h-full bg-[#d4af37]"></div>
                  <div className="w-1/2 h-full bg-transparent"></div>
                </div>
                <div className="p-8 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-2xl font-bold text-[#0d2818]">Trip Details</h3>
                    <span className="text-xs font-bold text-[#d4af37] uppercase tracking-wider">Step 1 of 2</span>
                  </div>
                  <form onSubmit={handleStartPlanning} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Trip Name</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#d4af37]"><span className="material-symbols-outlined">location_on</span></div>
                        <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-[#0d2818] placeholder:text-gray-400 focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] transition-all outline-none" placeholder="e.g. Pebble Beach" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Dates</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#d4af37] z-10 h-full"><span className="material-symbols-outlined">date_range</span></div>
                        <div className="w-full bg-white border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-[#d4af37] focus-within:border-[#d4af37] transition-all">
                          <DatePicker selectsRange={true} startDate={startDate} endDate={endDate} onChange={(update) => setDateRange(update)} isClearable={true} placeholderText="Start Date - End Date" className="w-full py-3 pl-10 pr-4 text-[#0d2818] outline-none" dateFormat="MMM d, yyyy" />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-500">Secure with Magic Link</label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#d4af37]"><span className="material-symbols-outlined">mail</span></div>
                        <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-[#0d2818] placeholder:text-gray-400 focus:ring-2 focus:ring-[#d4af37] focus:border-[#d4af37] transition-all outline-none" placeholder="name@email.com" type="email" required />
                      </div>
                    </div>
                    <button type="submit" disabled={loading} className="bg-[#1a4d2e] hover:bg-[#0d2818] text-white p-3 rounded-xl transition-colors flex items-center justify-center shadow-lg shadow-[#1a4d2e]/20 disabled:opacity-50 font-bold text-lg gap-2">
                      {loading ? 'Sending...' : 'Start Planning'}
                      {!loading && <span className="material-symbols-outlined">arrow_forward</span>}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center">We'll send a login link to your inbox. No passwords needed.</p>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- SIGN IN MODAL --- */}
        {showSignIn && (
          <div className="fixed inset-0 z-50 overflow-y-auto font-display">
            <div className="absolute inset-0 z-0">
              <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?q=80&w=2070&auto=format&fit=crop')` }}></div>
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-10"></div>
            </div>
            <div className="relative z-20 flex items-center justify-center h-full w-full px-4 sm:px-6">
              <div className="w-full max-w-[520px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-[fadeInUp_0.3s_ease-out]">
                {/* Header with Close Button */}
                <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#1e4d2b] tracking-wide uppercase">Welcome Back</span>
                  <button onClick={() => setShowSignIn(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* SIGN IN STEP 1: FORM */}
                {signInStep === 1 && (
                  <div className="px-8 pb-10 flex flex-col">
                    <div className="mb-8 text-center sm:text-left">
                      <h1 className="text-3xl font-bold text-[#111811] leading-tight mb-2">Sign In</h1>
                      <p className="text-gray-500 text-base">Enter your email to access your trips.</p>
                    </div>
                    <form onSubmit={handleSignIn} className="flex flex-col gap-6">
                      <label className="flex flex-col gap-2">
                        <span className="text-[#111811] text-base font-semibold">Email Address</span>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><span className="material-symbols-outlined text-gray-400">mail</span></div>
                          <input autoFocus className="block w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 bg-gray-50 text-[#111811] placeholder-gray-400 focus:border-[#1e4d2b] focus:ring-[#1e4d2b] focus:ring-1 transition-all duration-200 text-lg outline-none" placeholder="name@email.com" type="email" value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} required />
                        </div>
                      </label>
                      <button disabled={loading} className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-lg font-bold rounded-xl text-white bg-[#1e4d2b] hover:bg-[#153820] focus:outline-none transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50" type="submit">
                        {loading ? 'Sending...' : 'Send Magic Link'}
                      </button>
                    </form>
                  </div>
                )}

                {/* SIGN IN STEP 2: CONFIRMATION */}
                {signInStep === 2 && (
                  <div className="px-8 pb-10 flex flex-col items-center text-center">
                    <div className="relative mb-8 mt-2">
                      <div className="w-24 h-24 bg-[#1e4d2b]/10 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-[#1e4d2b] text-[48px]">mail</span></div>
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-md"><div className="bg-[#D4AF37] rounded-full w-8 h-8 flex items-center justify-center"><span className="material-symbols-outlined text-white text-[18px]">flag</span></div></div>
                    </div>
                    <div className="mb-6">
                      <h1 className="text-3xl font-bold text-[#111811] leading-tight mb-4">Check your inbox!</h1>
                      <p className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto">We've sent a secure login link to <strong>{signInEmail}</strong>.</p>
                    </div>
                    <button onClick={() => handleResend(signInEmail)} disabled={loading} className="w-full flex justify-center py-4 px-4 border border-gray-300 text-lg font-bold rounded-xl text-[#1e4d2b] hover:bg-gray-50 transition-all shadow-sm">
                      {loading ? 'Resending...' : 'Resend email'}
                    </button>
                    <button onClick={() => setSignInStep(1)} className="mt-4 text-sm font-medium text-gray-500 hover:text-[#1e4d2b] underline">Try different email</button>
                  </div>
                )}
                
                <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex justify-center items-center">
                  <div className="flex items-center gap-2 text-[#D4AF37] opacity-80"><span className="material-symbols-outlined text-sm">golf_course</span><span className="text-xs font-semibold tracking-wider uppercase">GolfTripHQ</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- CREATE TRIP CONFIRMATION MODAL --- */}
        {currentStep === 2 && (
          <div className="fixed inset-0 z-50 overflow-y-auto font-display">
             <div className="absolute inset-0 z-0">
               <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?q=80&w=2070&auto=format&fit=crop')` }}></div>
               <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-10"></div>
             </div>
             <div className="relative z-20 flex items-center justify-center h-full w-full px-4 sm:px-6">
               <div className="w-full max-w-[520px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-[fadeInUp_0.3s_ease-out]">
                 <div className="px-8 pt-8 pb-4">
                   <div className="flex items-center justify-between mb-3">
                     <span className="text-sm font-semibold text-[#1e4d2b] tracking-wide uppercase">Step 2 of 2</span>
                     <span className="text-sm text-gray-500 font-medium">Complete</span>
                   </div>
                   <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#D4AF37] w-full rounded-full"></div></div>
                 </div>
                 <div className="px-8 pb-10 flex flex-col items-center text-center">
                   <div className="relative mb-8 mt-2">
                     <div className="w-24 h-24 bg-[#1e4d2b]/10 rounded-full flex items-center justify-center"><span className="material-symbols-outlined text-[#1e4d2b] text-[48px]">mail</span></div>
                     <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1.5 shadow-md"><div className="bg-[#D4AF37] rounded-full w-8 h-8 flex items-center justify-center"><span className="material-symbols-outlined text-white text-[18px]">flag</span></div></div>
                   </div>
                   <div className="mb-6">
                     <h1 className="text-3xl font-bold text-[#111811] leading-tight mb-4">Check your inbox!</h1>
                     <p className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto">We've sent a magic link to your email. Click the link to securely access your <span className="font-semibold text-[#1e4d2b]">"{location || 'Golf Trip'}"</span> trip.</p>
                   </div>
                   <button onClick={() => handleResend(email)} disabled={loading} className="w-full flex justify-center py-4 px-4 border border-gray-300 text-lg font-bold rounded-xl text-[#1e4d2b] hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50">
                      {loading ? 'Resending...' : 'Resend email'}
                   </button>
                   <button onClick={() => handleEditEmail()} className="mt-4 text-sm font-medium text-gray-500 hover:text-[#1e4d2b] underline">Enter a different email</button>
                 </div>
                 <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex justify-center items-center">
                   <div className="flex items-center gap-2 text-[#D4AF37] opacity-80"><span className="material-symbols-outlined text-sm">golf_course</span><span className="text-xs font-semibold tracking-wider uppercase">Premium Golf Trips</span></div>
                 </div>
               </div>
             </div>
           </div>
        )}

        {/* --- FEATURES & FOOTER --- */}
        <div className="w-full py-24 px-4 sm:px-10 bg-[#f9fbf9] relative overflow-hidden">
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-[#d4af37]/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 w-96 h-96 bg-[#1a4d2e]/5 rounded-full blur-3xl"></div>
          <div className="max-w-7xl mx-auto flex flex-col gap-16 relative z-10">
            <div className="flex flex-col items-center text-center gap-4 max-w-3xl mx-auto">
              <h2 className="text-[#0d2818] text-3xl sm:text-4xl font-bold leading-tight tracking-tight">
                Everything you need for the <span className="text-[#1a4d2e]">perfect round</span>
              </h2>
              <p className="text-gray-600 text-lg font-normal leading-relaxed">
                Add tee times, split expenses, and manage travel all in one place.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <FeatureCard icon="schedule" title="Coordinate Tee Times" desc="Easily add rounds for your entire group and keep everyone on time." />
              <FeatureCard icon="payments" title="Split Expenses" desc="Track all expenses for the trip in one convenient place. Our balance feature will do the math for you at the end of the trip." />
              <FeatureCard icon="how_to_vote" title="Manage Travel" desc="Save flights, hotels, and other travel details for your group." />
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-12 px-4 sm:px-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[#0d2818] font-bold text-xl">
              <span className="material-symbols-outlined text-[#d4af37]">sports_golf</span>
              <span>GolfTripHQ</span>
            </div>
            <p className="text-sm text-gray-500">© 2026 GolfTripHQ Inc. All rights reserved.</p>
          </div>
          <div className="flex items-center gap-8 text-sm font-medium text-gray-600">
            <a className="hover:text-[#1a4d2e] transition-colors cursor-pointer">About</a>
            <a className="hover:text-[#1a4d2e] transition-colors cursor-pointer">Contact</a>
          </div>
          <div className="flex gap-4">
            <SocialIcon icon="podcasts" />
            <SocialIcon icon="alternate_email" />
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: { icon: string, title: string, desc: string }) {
  return (
    <div className="group flex flex-col gap-6 p-8 rounded-3xl bg-white border border-gray-100 shadow-xl shadow-gray-200/50 hover:-translate-y-1 transition-all duration-300">
      <div className="w-14 h-14 rounded-2xl bg-[#1a4d2e]/10 text-[#1a4d2e] flex items-center justify-center group-hover:scale-110 transition-transform">
        <span className="material-symbols-outlined text-3xl">{icon}</span>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="text-[#0d2818] text-xl font-bold">{title}</h3>
        <p className="text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function SocialIcon({ icon }: { icon: string }) {
  return (
    <a className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-[#1a4d2e] hover:text-white transition-all cursor-pointer">
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </a>
  )
}
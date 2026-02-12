'use client'

import { useEffect, useState, useRef, Suspense } from 'react' // <--- Added Suspense
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import OnboardingModal from '@/components/OnboardingModal'

interface Trip {
  id: string
  trip_name: string
  start_date: string
  end_date: string
  owner_id: string 
}

// 1. RENAME the main function to 'DashboardContent'
function DashboardContent() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const router = useRouter()
  const searchParams = useSearchParams()
  
  // Data State
  const [trips, setTrips] = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)
  const [debugStatus, setDebugStatus] = useState('Initializing...') 
  const [user, setUser] = useState<any>(null)
  
  // UI State
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showNewTripModal, setShowNewTripModal] = useState(false)
  const [newTripName, setNewTripName] = useState('')
  const [newTripDates, setNewTripDates] = useState<[Date | null, Date | null]>([null, null])
  const [startDate, endDate] = newTripDates
  const [creating, setCreating] = useState(false)

  // Ref to prevent double-firing
  const processingRef = useRef(false)

  useEffect(() => {
    let mounted = true

    const init = async () => {
      try {
        setDebugStatus('Checking Session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          if (mounted) {
            setDebugStatus('No session found. Redirecting...')
            router.replace('/')
          }
          return
        }

        if (!mounted) return
        setUser(session.user)

        setDebugStatus('Checking Profile...')
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', session.user.id)
          .single()

        if (!profile || !profile.full_name) {
          setDebugStatus('Profile incomplete. Starting onboarding...')
          setShowOnboarding(true)
          setLoading(false)
          return 
        }

        await handleRoutingLogic(session.user.id)

      } catch (err: any) {
        console.error('Dashboard Error:', err)
        if (mounted) setDebugStatus(`Error: ${err.message}`)
      }
    }

    init()

    return () => { mounted = false }
  }, []) 

  const handleRoutingLogic = async (userId: string) => {
    const tripNameParam = searchParams.get('tripName')
    
    if (tripNameParam && !processingRef.current) {
      processingRef.current = true
      setDebugStatus(`Creating Trip: ${tripNameParam}...`)
      await createTripFromUrl(userId, tripNameParam)
    } else {
      setDebugStatus('Fetching Trips...')
      await fetchTrips(userId)
      setLoading(false)
    }
  }

  const createTripFromUrl = async (userId: string, name: string) => {
    try {
      const start = searchParams.get('start')
      const end = searchParams.get('end')

      console.log("Processing Magic Trip:", name)

      const { data: newTrip, error: tripError } = await supabase.from('trips').insert({
          owner_id: userId,
          trip_name: decodeURIComponent(name),
          start_date: start || null, 
          end_date: end || null
        }).select().single()

      if (tripError) throw tripError

      if (newTrip) {
        await addOwnerToRoster(userId, newTrip.id)
      }

      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/dashboard')
      }

      await fetchTrips(userId)

    } catch (error) {
      console.error('Magic Link Error:', error)
      await fetchTrips(userId)
    } finally {
      setLoading(false)
    }
  }

  const fetchTrips = async (userId: string) => {
    try {
      const { data: ownedTrips } = await supabase.from('trips').select('*').eq('owner_id', userId)
      const { data: memberTripsData } = await supabase.from('trip_golfers').select('trip_id, trips(*)').eq('user_id', userId)
      const memberTrips = memberTripsData?.map((item: any) => item.trips) || []

      const allTripsMap = new Map()
      ;(ownedTrips || []).forEach(t => allTripsMap.set(t.id, t))
      ;(memberTrips || []).forEach(t => { if(t) allTripsMap.set(t.id, t) })

      const allTrips = Array.from(allTripsMap.values()).sort((a, b) => 
        new Date(a.start_date || 0).getTime() - new Date(b.start_date || 0).getTime()
      )

      setTrips(allTrips)
    } catch (error) {
      console.error('Fetch Error:', error)
    }
  }

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTripName || !startDate || !user) return

    setCreating(true)
    try {
      const { data: newTrip, error: tripError } = await supabase.from('trips').insert({
        owner_id: user.id,
        trip_name: newTripName,
        start_date: startDate.toISOString(),
        end_date: endDate ? endDate.toISOString() : null
      }).select().single()

      if (tripError) throw tripError

      if (newTrip) {
        await addOwnerToRoster(user.id, newTrip.id)
        setShowNewTripModal(false)
        setNewTripName('')
        setNewTripDates([null, null])
        fetchTrips(user.id)
      }
    } catch (error: any) {
      alert('Error creating trip: ' + error.message)
    } finally {
      setCreating(false)
    }
  }

  const addOwnerToRoster = async (userId: string, tripId: string) => {
    try {
      const { data: profile } = await supabase.from('profiles').select('full_name, handicap').eq('id', userId).single()
      
      const displayName = profile?.full_name || 'Organizer'
      const displayHcp = profile?.handicap ? Math.round(profile.handicap) : 0 

      await supabase.from('trip_golfers').insert({
        trip_id: tripId,
        user_id: userId,
        name: displayName,
        handicap: displayHcp
      })
    } catch (err) {
      console.error("Roster Add Failed:", err)
    }
  }

  const formatTripDates = (startStr: string, endStr?: string) => {
    if (!startStr) return 'Date TBD'
    const start = new Date(startStr)
    const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
    const startDay = start.getDate()
    const startYear = start.getFullYear()
    
    if (!endStr) return `${startMonth} ${startDay}, ${startYear}`
    
    const end = new Date(endStr)
    const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
    const endDay = end.getDate()
    const endYear = end.getFullYear()

    if (startYear === endYear) {
      if (startMonth === endMonth) return `${startMonth} ${startDay} - ${endDay}, ${startYear}`
      return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${startYear}`
    }
    return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`
  }

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false)
    setLoading(true)
    if (user) {
      await handleRoutingLogic(user.id)
    }
  }

  return (
    <div className="min-h-screen bg-[#f9fbf9] font-sans text-[#111814]">
      {/* DatePicker Styles */}
      <style jsx global>{`
        .react-datepicker-wrapper { width: 100%; }
        .react-datepicker__input-container input { width: 100%; background: transparent; border: none; padding: 12px; font-size: 1rem; color: #0d2818; outline: none; }
        .react-datepicker__header { background-color: #f9fbf9; border-bottom: 1px solid #e5e7eb; }
        .react-datepicker__day--selected { background-color: #1a4d2e !important; color: white !important; }
        .react-datepicker__day:hover { background-color: #e5c558 !important; color: black !important; }
        .react-datepicker-popper { z-index: 9999 !important; }
      `}</style>

      {/* --- HEADER --- */}
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
           <div className="text-[#D4AF37] flex items-center justify-center p-1 rounded-full bg-[#0d2818]/5">
              <span className="material-symbols-outlined text-2xl">sports_golf</span>
            </div>
          <h1 className="text-2xl font-bold text-[#0d2818]">My Trips</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => supabase.auth.signOut().then(() => router.push('/'))} className="text-sm font-medium text-gray-500 hover:text-[#1a4d2e] transition-colors">Sign Out</button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto">
        <p className="text-gray-500 mb-8">Manage your upcoming golf getaways</p>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-4 border-[#1a4d2e] border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-gray-400 font-mono">{debugStatus}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* 1. ADD CARD */}
            <button 
              onClick={() => setShowNewTripModal(true)} 
              className="bg-slate-50 rounded-2xl border-2 border-dashed border-slate-300 p-8 flex flex-col items-center justify-center text-center hover:border-[#1a4d2e] hover:bg-slate-100 transition-all group min-h-[300px]"
            >
              <div className="w-20 h-20 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
                <span className="material-symbols-outlined text-slate-400 group-hover:text-[#1a4d2e] text-4xl">add</span>
              </div>
              <h3 className="text-xl font-bold text-slate-500 group-hover:text-[#1a4d2e] transition-colors">Plan New Trip</h3>
              <p className="text-sm text-slate-400 mt-2 max-w-[200px]">Create a new itinerary, invite friends, and track scores.</p>
            </button>

            {/* 2. EXISTING TRIPS */}
            {trips.map(trip => (
              <Link key={trip.id} href={`/trip?id=${trip.id}`}>
                <div className="group bg-white border border-gray-200 rounded-2xl p-8 hover:border-[#d4af37] hover:shadow-md transition-all cursor-pointer relative overflow-hidden h-full flex flex-col justify-between min-h-[300px]">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 rounded-full bg-[#1a4d2e]/5 text-[#1a4d2e]">
                        <span className="material-symbols-outlined text-3xl">travel_explore</span>
                      </div>
                      {trip.owner_id === user?.id && (
                        <span className="bg-[#d4af37]/10 text-[#d4af37] text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">Organizer</span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-[#0d2818] mb-2 group-hover:text-[#1a4d2e] transition-colors line-clamp-2">{trip.trip_name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
                      <span className="material-symbols-outlined text-sm">calendar_month</span>
                      <span className="font-medium">{formatTripDates(trip.start_date, trip.end_date)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-auto">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover:text-[#1a4d2e] transition-colors">View Details</span>
                    <span className="material-symbols-outlined text-gray-300 group-hover:translate-x-1 transition-transform group-hover:text-[#1a4d2e]">arrow_forward</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* --- NEW TRIP MODAL --- */}
      {showNewTripModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowNewTripModal(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl animate-[fadeInUp_0.2s_ease-out]">
            <div className="p-6 border-b border-gray-100"><h3 className="text-xl font-bold text-[#0d2818]">Plan New Trip</h3></div>
            <div className="p-6">
              <form onSubmit={handleCreateTrip} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-gray-500">Trip Name</label>
                  <input autoFocus value={newTripName} onChange={e => setNewTripName(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="e.g. Bandon Dunes 2026" required />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-gray-500">Dates</label>
                  <div className="border border-gray-200 rounded-lg p-1 bg-white focus-within:ring-2 focus-within:ring-[#1a4d2e]">
                    <DatePicker selectsRange={true} startDate={startDate} endDate={endDate} onChange={(update) => setNewTripDates(update)} className="w-full p-2 outline-none" placeholderText="Select Date Range" required popperPlacement="bottom-start" />
                  </div>
                </div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setShowNewTripModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                  <button type="submit" disabled={creating} className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22] disabled:opacity-50">{creating ? 'Creating...' : 'Create Trip'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- ONBOARDING MODAL --- */}
      {showOnboarding && user && (
        <OnboardingModal userId={user.id} onComplete={handleOnboardingComplete} />
      )}
    </div>
  )
}

// 2. CREATE A NEW DEFAULT EXPORT WRAPPED IN SUSPENSE
export default function Dashboard() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#f9fbf9]"><div className="w-8 h-8 border-4 border-[#1a4d2e] border-t-transparent rounded-full animate-spin"></div></div>}>
      <DashboardContent />
    </Suspense>
  )
}
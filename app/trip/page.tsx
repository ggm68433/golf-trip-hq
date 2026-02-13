'use client'

import { useEffect, useState, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr' 
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trip, Golfer, Round, Lodging, Dining, Expense, RoundWeather } from './types'

// Components
import TripRoster from './components/TripRoster'
import TripGolf from './components/TripGolf'
import TripFlights from './components/TripFlights'
import TripLodging from './components/TripLodging'
import TripDining from './components/TripDining'
import TripExpenses from './components/TripExpenses'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function TripPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tripId = searchParams.get('id')

  // Data State
  const [trip, setTrip] = useState<Trip | null>(null)
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [lodgings, setLodgings] = useState<Lodging[]>([])
  const [dinings, setDinings] = useState<Dining[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  
  // UI State
  const [weatherMap, setWeatherMap] = useState<Record<string, RoundWeather>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Roster') 

  useEffect(() => {
    if (!tripId) return
    
    // 1. Listen for Auth Changes (Fixes the "Not Logged In" issue)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // As soon as we detect a user, try to accept the invite
        acceptInvite(tripId, session.user.id)
      }
    })

    const init = async () => {
      const { data: tripData, error } = await supabase.from('trips').select('*').eq('id', tripId).single()
      
      if (error) console.error("Error fetching trip:", error)
      if (tripData) {
        setTrip(tripData)
        // Also check immediately in case session is already there
        const { data: { user } } = await supabase.auth.getUser()
        if (user) acceptInvite(tripData.id, user.id)
      }

      await refreshAll()
      setLoading(false)
    }
    init()

    return () => {
      subscription.unsubscribe()
    }
  }, [tripId])

  // Separate function to handle the "Auto-Accept" logic
  const acceptInvite = async (tId: string, userId: string) => {
    // 1. Flip status from 'invited' to 'accepted'
    const { error: acceptError } = await supabase
      .from('trip_golfers')
      .update({ status: 'accepted' })
      .eq('trip_id', tId)
      .eq('user_id', userId)
      .eq('status', 'invited')
    
    if (acceptError) {
        console.error("Error accepting invite:", acceptError.message)
    } else {
        // If successful, refresh the roster to show the green checkmark
        fetchRoster() 
    }
  }

  const refreshAll = async () => {
    await Promise.all([fetchRoster(), fetchRounds(), fetchLodging(), fetchDining(), fetchExpenses()])
  }

  const fetchRoster = async () => {
    if (!tripId) return
    const { data: rosterData } = await supabase.from('trip_golfers').select(`*, flights:golfer_flights(*)`).eq('trip_id', tripId)
    if (!rosterData) return

    const userIds = rosterData.map(g => g.user_id).filter(uid => uid !== null)
    let profilesMap: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds)
      if (profiles) profiles.forEach(p => profilesMap[p.id] = p.full_name)
    }

    setGolfers(rosterData.map(g => ({ ...g, profile_name: g.user_id ? profilesMap[g.user_id] : undefined })) as any)
  }

  const fetchRounds = async () => {
    if (!tripId) return
    const { data } = await supabase.from('rounds').select(`*, courses ( id, name, address, city, state, zip_code ), round_players ( trip_golfers ( id, name, handicap ) )`).eq('trip_id', tripId).order('round_date', { ascending: true }).order('tee_time', { ascending: true })
    if (data) {
      const roundsData = data as any
      setRounds(roundsData)
      fetchWeather(roundsData)
    }
  }

  const fetchLodging = async () => {
    if (!tripId) return
    const { data } = await supabase.from('trip_lodging').select('*').eq('trip_id', tripId).order('check_in_time', { ascending: true })
    if (data) setLodgings(data as any)
  }

  const fetchDining = async () => {
    if (!tripId) return
    const { data } = await supabase.from('trip_dining').select('*').eq('trip_id', tripId).order('reservation_time', { ascending: true })
    if (data) setDinings(data as any)
  }

  const fetchExpenses = async () => {
    if (!tripId) return
    const { data } = await supabase.from('trip_expenses').select('*').eq('trip_id', tripId).order('expense_date', { ascending: false })
    if (data) setExpenses(data as any)
  }

  const fetchWeather = async (roundsData: Round[]) => {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
    if (!apiKey) return 

    const newWeatherMap: Record<string, RoundWeather> = {}

    await Promise.all(roundsData.map(async (round) => {
      if (!round.courses?.city || !round.courses?.state || !round.round_date) return

      try {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${round.courses.city},${round.courses.state},US&limit=1&appid=${apiKey}`
        const geoRes = await fetch(geoUrl)
        const geoData = await geoRes.json()

        if (!geoData || geoData.length === 0) return

        const { lat, lon } = geoData[0]
        const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&appid=${apiKey}`
        const weatherRes = await fetch(weatherUrl)
        const weatherData = await weatherRes.json()

        if (!weatherData.list) return

        const targetDate = round.round_date 
        const dayForecasts = weatherData.list.filter((item: any) => item.dt_txt.startsWith(targetDate))

        if (dayForecasts.length > 0) {
          const bestMatch = dayForecasts[Math.floor(dayForecasts.length / 2)]
          newWeatherMap[round.id] = {
            temp: Math.round(bestMatch.main.temp),
            description: bestMatch.weather[0].main, 
            icon: bestMatch.weather[0].icon,        
            wind_speed: Math.round(bestMatch.wind.speed),
            pop: Math.round(bestMatch.pop * 100)    
          }
        }
      } catch (err) {
        console.error("Weather fetch failed", err)
      }
    }))

    setWeatherMap(newWeatherMap)
  }

  const formatDateRange = (startStr?: string, endStr?: string) => {
    if (!startStr) return 'Date TBD'
    
    const parseLocal = (s: string) => {
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, m - 1, d)
    }

    const start = parseLocal(startStr)
    const end = endStr ? parseLocal(endStr) : null

    const startMonth = start.toLocaleString('en-US', { month: 'short' })
    const startDay = start.getDate()
    const year = start.getFullYear()

    if (!end) return `${startMonth} ${startDay}, ${year}`

    const endMonth = end.toLocaleString('en-US', { month: 'short' })
    const endDay = end.getDate()
    const endYear = end.getFullYear()

    if (startMonth === endMonth && year === endYear) return `${startMonth} ${startDay} - ${endDay}, ${year}`
    if (year === endYear) return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`
    return `${startMonth} ${startDay}, ${year} - ${endMonth} ${endDay}, ${endYear}`
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#f8f8f5]"><div className="w-8 h-8 border-4 border-[#1a4d2e] border-t-transparent rounded-full animate-spin"></div></div>

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-[#f8f8f5] text-[#221f10]">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between z-20">
        <div className="p-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-[#1a4d2e] mb-6 transition-colors group">
            <span className="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
            <span className="text-xs font-bold uppercase tracking-wider">Back to Trips</span>
          </Link>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-[#1a4d2e] text-[#f2d00d] flex items-center justify-center shadow-md shrink-0"><span className="material-symbols-outlined">sports_golf</span></div>
            <div>
              <h1 className="text-slate-900 font-bold text-sm leading-tight line-clamp-2">{trip?.trip_name || 'Loading Trip...'}</h1>
              <p className="text-slate-500 text-xs font-medium mt-0.5">
                {formatDateRange(trip?.start_date, trip?.end_date)}
              </p>
            </div>
          </div>
          <nav className="flex flex-col gap-1">
            {['Roster', 'Golf', 'Flight', 'Lodging', 'Dining', 'Expenses'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-colors ${activeTab === tab ? 'bg-[#f2d00d]/20 text-[#1a4d2e] font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium'}`}>
                <span className="material-symbols-outlined text-[20px]">{getIcon(tab)}</span><span className="text-sm">{tab === 'Flight' ? 'Flight Info' : tab}</span>
              </button>
            ))}
          </nav>
        </div>
        <div className="p-4 border-t border-slate-100">
          <button className="flex items-center gap-3 w-full p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <div className="w-9 h-9 rounded-full bg-[#1a4d2e]/10 flex items-center justify-center text-[#1a4d2e] font-bold text-xs">ME</div>
            <div className="text-left"><p className="text-sm font-bold text-slate-900">My Profile</p><p className="text-xs text-slate-500">View Settings</p></div>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#f8f8f5]">
        {activeTab === 'Roster' && (
          <TripRoster 
            tripId={tripId!} 
            golfers={golfers} 
            tripOwnerId={trip?.owner_id} 
            tripName={trip?.trip_name} 
            onUpdate={fetchRoster} 
          />
        )}
        {activeTab === 'Golf' && <TripGolf tripId={tripId!} rounds={rounds} golfers={golfers} weatherMap={weatherMap} onUpdate={fetchRounds} />}
        {activeTab === 'Flight' && <TripFlights tripId={tripId!} golfers={golfers} onUpdate={fetchRoster} />}
        {activeTab === 'Lodging' && <TripLodging tripId={tripId!} lodgings={lodgings} trip={trip} onUpdate={fetchLodging} />}
        {activeTab === 'Dining' && <TripDining tripId={tripId!} dinings={dinings} onUpdate={fetchDining} />}
        {activeTab === 'Expenses' && <TripExpenses tripId={tripId!} expenses={expenses} golfers={golfers} onUpdate={fetchExpenses} />}
      </main>
    </div>
  )
}

function getIcon(tab: string) {
  const map: Record<string, string> = { Roster: 'groups', Golf: 'golf_course', Flight: 'flight', Lodging: 'bed', Dining: 'restaurant', Expenses: 'payments' }
  return map[tab]
}

export default function TripPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#f8f8f5]"><div className="w-8 h-8 border-4 border-[#1a4d2e] border-t-transparent rounded-full animate-spin"></div></div>}>
      <TripPageContent />
    </Suspense>
  )
}
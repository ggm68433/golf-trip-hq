'use client'

import { useState, useRef, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { Round, Golfer, RoundWeather, Course } from '../types'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TripGolf({ 
  tripId, 
  rounds, 
  golfers, 
  weatherMap, 
  onUpdate 
}: { 
  tripId: string, 
  rounds: Round[], 
  golfers: Golfer[], 
  weatherMap: Record<string, RoundWeather>, 
  onUpdate: () => void 
}) {
  // --- STATE ---
  const [showModal, setShowModal] = useState(false)
  const [editingRoundId, setEditingRoundId] = useState<string | null>(null)

  // Form State
  const [courseName, setCourseName] = useState('')
  const [courseAddress, setCourseAddress] = useState('')
  const [courseCity, setCourseCity] = useState('')
  const [courseState, setCourseState] = useState('')
  const [courseZip, setCourseZip] = useState('')
  const [roundDate, setRoundDate] = useState<Date | null>(null)
  const [teeTime, setTeeTime] = useState('')
  const [selectedGolferIds, setSelectedGolferIds] = useState<string[]>([])

  // Search State
  const [searchResults, setSearchResults] = useState<Course[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // --- HELPERS ---
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  
  const formatDate = (dateStr: string) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  
  const formatTime = (timeStr: string) => { 
    if (!timeStr) return ''
    const [hours, minutes] = timeStr.split(':')
    const h = parseInt(hours, 10)
    const suffix = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${minutes} ${suffix}` 
  }

  const buildAddressString = (course?: any) => { 
    if (!course) return ''
    const parts = [course.address, course.city, course.state, course.zip_code].filter(Boolean)
    return parts.join(', ') 
  }

  const toggleGolferSelection = (id: string) => { 
    if (selectedGolferIds.includes(id)) setSelectedGolferIds(selectedGolferIds.filter(g => g !== id))
    else setSelectedGolferIds([...selectedGolferIds, id]) 
  }

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // --- SEARCH LOGIC ---
  const handleSearchChange = async (val: string) => {
    setCourseName(val)
    
    if (val.length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    const { data } = await supabase
      .from('courses')
      .select('*')
      .ilike('name', `%${val}%`)
      .limit(5)

    if (data && data.length > 0) {
      setSearchResults(data)
      setShowDropdown(true)
    } else {
      setSearchResults([])
      setShowDropdown(false)
    }
  }

  const handleSelectCourse = (course: Course) => {
    setCourseName(course.name)
    setCourseAddress(course.address || '')
    setCourseCity(course.city || '')
    setCourseState(course.state || '')
    setCourseZip(course.zip_code || '')
    setShowDropdown(false)
  }

  // --- GROUPING LOGIC ---
  const roundsByDate = rounds.reduce((acc: Record<string, Round[]>, round) => { 
    const date = round.round_date
    if (!acc[date]) acc[date] = []
    acc[date].push(round)
    return acc 
  }, {})
  
  const sortedDates = Object.keys(roundsByDate).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())

  // --- ACTIONS ---
  const handleOpenRoundModal = (round?: Round) => {
    if (round) {
      setEditingRoundId(round.id)
      setCourseName(round.courses?.name || '')
      setCourseAddress(round.courses?.address || '')
      setCourseCity(round.courses?.city || '')
      setCourseState(round.courses?.state || '')
      setCourseZip(round.courses?.zip_code || '')
      setRoundDate(new Date(round.round_date + 'T12:00:00')) 
      setTeeTime(round.tee_time)
      setSelectedGolferIds(round.round_players?.map(p => p.trip_golfers.id) || [])
    } else {
      setEditingRoundId(null)
      setCourseName('')
      setCourseAddress('')
      setCourseCity('')
      setCourseState('')
      setCourseZip('')
      setRoundDate(null)
      setTeeTime('')
      setSelectedGolferIds([])
    }
    setShowModal(true)
    setShowDropdown(false)
  }

  const handleSaveRound = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseName || !roundDate || !teeTime || !tripId) return
    
    const dateStr = roundDate.toISOString().split('T')[0]
    let courseId = null

    // 1. Check if course exists or create new
    const { data: existingCourse } = await supabase.from('courses').select('id').ilike('name', courseName).single()
    
    if (existingCourse) {
      courseId = existingCourse.id
    } else {
      const { data: newCourse } = await supabase.from('courses').insert({ 
        name: courseName, 
        address: courseAddress, 
        city: courseCity, 
        state: courseState, 
        zip_code: courseZip 
      }).select().single()
      if (newCourse) courseId = newCourse.id
    }

    if (!courseId) return alert('Error saving course')

    let roundId = editingRoundId

    // 2. Insert or Update Round
    if (editingRoundId) {
      await supabase.from('rounds').update({ 
        course_id: courseId, 
        round_date: dateStr, 
        tee_time: teeTime 
      }).eq('id', editingRoundId)
    } else {
      const { data: newRound } = await supabase.from('rounds').insert({ 
        trip_id: tripId, 
        course_id: courseId, 
        round_date: dateStr, 
        tee_time: teeTime 
      }).select().single()
      if (newRound) roundId = newRound.id
    }

    // 3. Update Players (Delete all, re-insert)
    if (roundId) {
      await supabase.from('round_players').delete().eq('round_id', roundId)
      if (selectedGolferIds.length > 0) {
        await supabase.from('round_players').insert(
          selectedGolferIds.map(gid => ({ round_id: roundId, golfer_id: gid }))
        )
      }
    }

    setShowModal(false)
    onUpdate()
  }

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col gap-8 pb-20">
      
      {/* --- HEADER (Title Only) --- */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Golf Itinerary</h2>
        <p className="text-sm text-slate-500 mt-1">Tee times, courses, and pairings</p>
      </div>

      {/* --- STATS BAR --- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1a4d2e]/10 text-[#1a4d2e]">
            <span className="material-symbols-outlined">golf_course</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Rounds</p>
            <p className="text-xl font-bold text-slate-900">{rounds.length} Rounds</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm border border-slate-200">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <span className="material-symbols-outlined">groups</span>
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Golfers</p>
            <p className="text-xl font-bold text-slate-900">{golfers.length} Players</p>
          </div>
        </div>
      </div>

      {/* --- TIMELINE --- */}
      {sortedDates.map((dateStr) => {
        const dayRounds = roundsByDate[dateStr]
        return (
          <div key={dateStr} className="flex flex-col gap-6">
            
            {/* Date Header */}
            <div className="flex items-center gap-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                {dayRounds.length}
              </div>
              <h3 className="text-lg font-bold text-slate-900">{formatDate(dateStr)}</h3>
              <div className="h-px flex-1 bg-slate-200"></div>
            </div>

            {/* Round Cards */}
            {dayRounds.map(round => {
              const weather = weatherMap[round.id]
              const playerCount = round.round_players?.length || 0
              const isPractice = round.courses?.name?.toLowerCase().includes('range') || round.courses?.name?.toLowerCase().includes('practice')
              const cardOpacity = isPractice ? 'opacity-90 hover:opacity-100 bg-slate-50' : 'bg-white'
              
              return (
                <div key={round.id} className={`group relative flex flex-col overflow-hidden rounded-2xl ${cardOpacity} shadow-sm border border-slate-200 transition-all hover:shadow-md`}>
                  
                  {/* Edit Button (Hidden until hover) */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenRoundModal(round)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-[#1a4d2e] hover:text-white transition-colors">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>

                  <div className="flex flex-col p-6">
                    {/* Top Badges */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${isPractice ? 'bg-slate-200 text-slate-700 ring-slate-300' : 'bg-[#1a4d2e]/10 text-[#1a4d2e] ring-[#1a4d2e]/20'}`}>
                          {formatTime(round.tee_time)} {isPractice ? 'Event Time' : 'Tee Time'}
                        </span>
                        
                        {/* WEATHER BADGE */}
                        {weather && weather.temp !== null && (
                          <div className="flex items-center gap-1 bg-[#d4af37] text-white rounded-full pr-2 pl-1 py-0.5 text-[10px] font-bold shadow-sm select-none">
                            <div className="relative w-5 h-5 flex-shrink-0">
                              {weather.icon && (
                                <img 
                                  src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`} 
                                  alt={weather.description} 
                                  className="absolute inset-0 w-full h-full object-contain"
                                />
                              )}
                            </div>
                            <span className="leading-none mt-[1px]">{weather.temp}°F</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Course Info */}
                    <h3 className={`text-2xl font-bold ${isPractice ? 'text-slate-700' : 'text-slate-900'} group-hover:text-[#1a4d2e] transition-colors`}>
                      {round.courses?.name}
                    </h3>
                    {round.courses && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                        <span className="material-symbols-outlined text-slate-400 text-[18px]">location_on</span>
                        <span>{buildAddressString(round.courses)}</span>
                      </div>
                    )}

                    {/* Footer / Attendees */}
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {isPractice ? 'Attendees' : 'Tee Sheet'} ({playerCount})
                        </span>
                        <div className="flex items-center -space-x-2">
                          {round.round_players?.map((p, i) => (
                            <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white bg-slate-100 text-xs font-bold text-slate-600" title={p.trip_golfers.name}>
                              {getInitials(p.trip_golfers.name)}
                            </div>
                          ))}
                        </div>
                        {playerCount === 0 && <span className="text-xs text-slate-400 italic">No players assigned</span>}
                      </div>
                      
                      {/* Pairings Button (Hidden) */}
                      {!isPractice && (
                        <div className="hidden flex items-center gap-2">
                          <button className="text-xs font-medium text-[#1a4d2e] hover:underline opacity-50 cursor-not-allowed" title="Coming Soon">View Pairing Details</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {/* --- ADD BUTTON (Bottom) --- */}
      <div className="mt-8 flex justify-center">
        <button onClick={() => handleOpenRoundModal()} className="group flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-6 py-3 text-sm font-medium text-slate-500 transition-all hover:border-[#1a4d2e] hover:bg-[#1a4d2e]/5 hover:text-[#1a4d2e]">
          <span className="material-symbols-outlined transition-transform group-hover:rotate-90">add</span> Add Another Round
        </button>
      </div>

      {/* --- MODAL --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-[fadeInUp_0.2s_ease-out] flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-[#0d2818]">{editingRoundId ? 'Edit Round' : 'Add New Round'}</h3>
            </div>
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleSaveRound} className="flex flex-col gap-5">
                
                {/* Course Inputs (Type-Ahead) */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase text-gray-500">Course Details</label>
                  
                  {/* Search Wrapper */}
                  <div className="relative" ref={wrapperRef}>
                    <input 
                      value={courseName} 
                      onChange={e => handleSearchChange(e.target.value)} 
                      className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" 
                      placeholder="Search Course Name..." 
                      required 
                    />
                    
                    {/* DROPDOWN RESULTS */}
                    {showDropdown && searchResults.length > 0 && (
                      <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-xl max-h-60 overflow-y-auto animate-[fadeIn_0.1s_ease-out]">
                        {searchResults.map((course) => (
                          <li 
                            key={course.id} 
                            onClick={() => handleSelectCourse(course)}
                            className="p-3 hover:bg-slate-50 cursor-pointer text-sm border-b border-gray-50 last:border-0 transition-colors"
                          >
                            <div className="font-bold text-slate-900">{course.name}</div>
                            <div className="text-xs text-slate-500">{course.city}, {course.state}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <input value={courseAddress} onChange={e => setCourseAddress(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="Street Address" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={courseCity} onChange={e => setCourseCity(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="City" />
                    <div className="grid grid-cols-2 gap-3">
                      <input value={courseState} onChange={e => setCourseState(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="ST" />
                      <input value={courseZip} onChange={e => setCourseZip(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="Zip" />
                    </div>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Date</label>
                    <div className="border border-gray-200 rounded-lg p-1 bg-white focus-within:ring-2 focus-within:ring-[#1a4d2e]">
                      <DatePicker selected={roundDate} onChange={(date: Date | null) => setRoundDate(date)} className="w-full p-2 outline-none" placeholderText="Select Date" required />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase text-gray-500">Tee Time</label>
                    <input type="time" value={teeTime} onChange={e => setTeeTime(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" required />
                  </div>
                </div>

                {/* Player Select */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-gray-500">Select Players</label>
                  <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-gray-100">
                    {golfers.map(golfer => (
                      <div key={golfer.id} onClick={() => toggleGolferSelection(golfer.id)} className={`p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 ${selectedGolferIds.includes(golfer.id) ? 'bg-[#1a4d2e]/5' : ''}`}>
                        <span className="text-sm font-medium text-slate-700">{golfer.name}</span>
                        {selectedGolferIds.includes(golfer.id) && (
                          <span className="material-symbols-outlined text-[#1a4d2e] text-sm">check_circle</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22]">{editingRoundId ? 'Save Changes' : 'Create Round'}</button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { Golfer, Flight } from '../types'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TripFlights({ tripId, golfers, onUpdate }: { tripId: string, golfers: Golfer[], onUpdate: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  
  // Local State
  const [localGolfers, setLocalGolfers] = useState<Golfer[]>(golfers)
  useEffect(() => { setLocalGolfers(golfers) }, [golfers])
  
  const [golferId, setGolferId] = useState('')
  const [legType, setLegType] = useState<'arrival' | 'departure'>('arrival')
  const [airline, setAirline] = useState('')
  const [flightNum, setFlightNum] = useState('')
  const [depAirport, setDepAirport] = useState('')
  const [arrAirport, setArrAirport] = useState('')
  const [flightDate, setFlightDate] = useState<Date | null>(null)
  const [depTime, setDepTime] = useState('')
  const [arrTime, setArrTime] = useState('')

  const todayStr = new Date().toISOString().split('T')[0]
  const arrivalsToday = localGolfers.filter(g => !g.is_driving && g.flights?.some(f => f.leg_type === 'arrival' && f.arrival_time && f.arrival_time.startsWith(todayStr))).length
  const confirmedGolfers = localGolfers.filter(g => g.is_driving || (g.flights?.some(f => f.leg_type === 'arrival') && g.flights?.some(f => f.leg_type === 'departure'))).length
  const missingInfo = localGolfers.length - confirmedGolfers

  const handleToggleDriving = async (golfer: Golfer) => {
    const newState = !golfer.is_driving
    setLocalGolfers(prev => prev.map(g => g.id === golfer.id ? { ...g, is_driving: newState } : g))
    const { error } = await supabase.from('trip_golfers').update({ is_driving: newState }).eq('id', golfer.id)
    if (error) {
      setLocalGolfers(prev => prev.map(g => g.id === golfer.id ? { ...g, is_driving: !newState } : g))
      alert("Error: " + error.message)
    } else {
      onUpdate()
    }
  }

  const handleOpenModal = (gId: string, type: 'arrival' | 'departure', flight?: Flight) => {
    setGolferId(gId); setLegType(type);
    if (flight) {
      setEditingId(flight.id); setAirline(flight.airline); setFlightNum(flight.flight_number); setDepAirport(flight.departure_airport); setArrAirport(flight.arrival_airport);
      
      // FIX: Manual Parsing
      const isoStr = type === 'arrival' ? flight.arrival_time : flight.departure_time
      if (isoStr) {
        const [dStr, tStr] = isoStr.split('T')
        const [y, m, d] = dStr.split('-').map(Number)
        setFlightDate(new Date(y, m - 1, d, 12, 0, 0))
      }

      // Extract times from strings directly
      const depIso = flight.departure_time; const arrIso = flight.arrival_time
      setDepTime(depIso.split('T')[1]?.slice(0, 5) || '')
      setArrTime(arrIso.split('T')[1]?.slice(0, 5) || '')

    } else {
      setEditingId(null); setAirline(''); setFlightNum(''); setDepAirport(''); setArrAirport(''); setFlightDate(null); setDepTime(''); setArrTime('');
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!flightDate || !depTime || !arrTime || !golferId) return

    // FIX: en-CA format
    const dateStr = flightDate.toLocaleDateString('en-CA')
    const fullDep = `${dateStr}T${depTime}:00`
    const fullArr = `${dateStr}T${arrTime}:00`

    const payload = { golfer_id: golferId, trip_id: tripId, leg_type: legType, airline: airline, flight_number: flightNum, departure_airport: depAirport, arrival_airport: arrAirport, departure_time: fullDep, arrival_time: fullArr }
    
    if (editingId) await supabase.from('golfer_flights').update(payload).eq('id', editingId); else await supabase.from('golfer_flights').insert(payload);
    setShowModal(false); onUpdate()
  }

  const getInitials = (n: string) => n.split(' ').map(c => c[0]).join('').substring(0, 2).toUpperCase()
  
  // FIX: Manual Parsing Helper
  const formatDateTime = (iso: string) => { 
    if (!iso) return { date: '—', time: '—' }
    const [datePart, timePart] = iso.split('T')
    if (!datePart || !timePart) return { date: '—', time: '—' }
    const [y, m, d] = datePart.split('-').map(Number)
    const [h, min] = timePart.split(':').map(Number)
    const localDate = new Date(y, m - 1, d, h, min)
    return { date: localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), time: localDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) } 
  }

  return (
    <div className="p-8 max-w-7xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-6"><div><h2 className="text-2xl font-bold text-slate-900 tracking-tight">Flight Information</h2><p className="text-sm text-slate-500 mt-1">Track arrivals, departures, and travel status.</p></div></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm"><div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600"><span className="material-symbols-outlined">flight_land</span></div><div><p className="text-slate-500 text-xs uppercase font-bold tracking-wider">Arrivals Today</p><p className="text-slate-900 text-xl font-bold">{arrivalsToday} Golfers</p></div></div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm"><div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600"><span className="material-symbols-outlined">warning</span></div><div><p className="text-slate-500 text-xs uppercase font-bold tracking-wider">Missing Info</p><p className="text-slate-900 text-xl font-bold">{missingInfo} Golfers</p></div></div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4 shadow-sm"><div className="h-12 w-12 rounded-full bg-green-50 flex items-center justify-center text-[#1a4d2e]"><span className="material-symbols-outlined">check_circle</span></div><div><p className="text-slate-500 text-xs uppercase font-bold tracking-wider">Confirmed</p><p className="text-slate-900 text-xl font-bold">{confirmedGolfers}/{localGolfers.length}</p></div></div>
      </div>
      <div className="flex flex-col gap-4">
        {localGolfers.map((golfer) => {
          const arrival = golfer.flights?.find(f => f.leg_type === 'arrival')
          const departure = golfer.flights?.find(f => f.leg_type === 'departure')
          const isComplete = golfer.is_driving || (arrival && departure)
          const statusText = golfer.is_driving ? 'Driving' : isComplete ? 'Confirmed' : 'Incomplete'
          const statusColor = golfer.is_driving ? 'text-blue-600' : isComplete ? 'text-slate-500' : 'text-amber-600'
          const dotColor = golfer.is_driving ? 'bg-blue-500' : isComplete ? 'bg-[#1a4d2e]' : 'bg-amber-500 animate-pulse'
          return (
            <div key={golfer.id} className="bg-white border border-slate-200 hover:border-[#d4af37] hover:shadow-md rounded-xl p-5 transition-all">
              <div className="flex flex-col xl:flex-row gap-6 items-start xl:items-center">
                <div className="w-full xl:w-auto xl:min-w-[300px] flex items-center justify-between pr-4">
                  <div className="flex items-center gap-4"><div className="relative"><div className="bg-[#1a4d2e]/5 rounded-full h-14 w-14 ring-2 ring-white flex items-center justify-center text-lg font-bold text-[#1a4d2e] border border-[#1a4d2e]/10">{getInitials(golfer.name)}</div><div className="absolute -bottom-1 -right-1 bg-[#d4af37] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white shadow-sm">HC {golfer.handicap}</div></div><div><h3 className="text-slate-900 text-lg font-bold leading-tight">{golfer.name}</h3><p className={`text-sm mt-0.5 flex items-center gap-1 font-medium ${statusColor}`}><span className={`w-2 h-2 rounded-full ${dotColor}`}></span>{statusText}</p></div></div>
                  <div className="flex flex-col items-end gap-1 cursor-pointer group" onClick={() => handleToggleDriving(golfer)}><div className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${golfer.is_driving ? 'bg-blue-500' : 'bg-slate-200'}`}><div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${golfer.is_driving ? 'translate-x-4' : 'translate-x-0'}`}></div></div><span className={`text-[10px] font-bold uppercase tracking-wider group-hover:text-blue-500 transition-colors ${golfer.is_driving ? 'text-blue-500' : 'text-slate-300'}`}>Driving</span></div>
                </div>
                <div className="w-full xl:flex-1">
                  {golfer.is_driving ? (
                    <div className="h-full min-h-[100px] bg-blue-50/50 border border-blue-100 rounded-lg flex flex-col items-center justify-center text-blue-600 gap-2"><div className="flex items-center gap-2 opacity-80"><span className="material-symbols-outlined text-2xl">directions_car</span><span className="font-bold text-sm">Traveling by Car</span></div></div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {arrival ? (
                        <div onClick={() => handleOpenModal(golfer.id, 'arrival', arrival)} className="cursor-pointer bg-slate-50 rounded-lg p-4 border-l-4 border-[#1a4d2e] relative overflow-hidden hover:bg-slate-100 transition-colors"><div className="absolute top-0 right-0 p-2 opacity-5"><span className="material-symbols-outlined text-6xl -mr-4 -mt-4 rotate-45">flight</span></div><div className="relative z-10"><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-[#1a4d2e] uppercase bg-white px-2 py-0.5 rounded shadow-sm">Arrival</span><span className="text-xs text-slate-500 font-medium">{formatDateTime(arrival.arrival_time).date}</span></div><div className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{arrival.airline} {arrival.flight_number}</div></div><div className="flex items-end justify-between"><div><div className="flex items-center gap-2 text-slate-900 font-mono text-lg font-bold"><span>{arrival.departure_airport}</span><span className="material-symbols-outlined text-sm text-[#d4af37]">arrow_forward</span><span>{arrival.arrival_airport}</span></div></div><div className="text-xl font-bold text-slate-900">{formatDateTime(arrival.arrival_time).time}</div></div></div></div>
                      ) : (
                        <button onClick={() => handleOpenModal(golfer.id, 'arrival')} className="bg-white rounded-lg border border-dashed border-slate-300 p-4 flex flex-col items-center justify-center min-h-[100px] hover:bg-slate-50 hover:border-[#1a4d2e] transition-colors group"><span className="material-symbols-outlined text-slate-400 group-hover:text-[#1a4d2e]">add</span><p className="text-xs font-medium text-slate-500 group-hover:text-[#1a4d2e] mt-1">Add Arrival</p></button>
                      )}
                      {departure ? (
                        <div onClick={() => handleOpenModal(golfer.id, 'departure', departure)} className="cursor-pointer bg-slate-50 rounded-lg p-4 border-l-4 border-[#d4af37] relative overflow-hidden hover:bg-slate-100 transition-colors"><div className="absolute top-0 right-0 p-2 opacity-5"><span className="material-symbols-outlined text-6xl -mr-4 -mt-4 -rotate-45">flight</span></div><div className="relative z-10"><div className="flex justify-between items-start mb-2"><div className="flex items-center gap-2"><span className="text-[10px] font-bold text-amber-700 uppercase bg-white px-2 py-0.5 rounded shadow-sm">Departure</span><span className="text-xs text-slate-500 font-medium">{formatDateTime(departure.departure_time).date}</span></div><div className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">{departure.airline} {departure.flight_number}</div></div><div className="flex items-end justify-between"><div><div className="flex items-center gap-2 text-slate-900 font-mono text-lg font-bold"><span>{departure.departure_airport}</span><span className="material-symbols-outlined text-sm text-[#d4af37]">arrow_forward</span><span>{departure.arrival_airport}</span></div></div><div className="text-xl font-bold text-slate-900">{formatDateTime(departure.departure_time).time}</div></div></div></div>
                      ) : (
                        <button onClick={() => handleOpenModal(golfer.id, 'departure')} className="bg-white rounded-lg border border-dashed border-slate-300 p-4 flex flex-col items-center justify-center min-h-[100px] hover:bg-slate-50 hover:border-[#1a4d2e] transition-colors group"><span className="material-symbols-outlined text-slate-400 group-hover:text-[#1a4d2e]">add</span><p className="text-xs font-medium text-slate-500 group-hover:text-[#1a4d2e] mt-1">Add Departure</p></button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4"><span className="material-symbols-outlined text-[#1a4d2e]">{legType === 'arrival' ? 'flight_land' : 'flight_takeoff'}</span><h3 className="text-xl font-bold text-[#0d2818]">{editingId ? 'Edit' : 'Add'} {legType === 'arrival' ? 'Arrival' : 'Departure'}</h3></div>
            <form onSubmit={handleSave} className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4"><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Airline</label><input value={airline} onChange={e => setAirline(e.target.value)} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="Delta" required /></div><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Flight #</label><input value={flightNum} onChange={e => setFlightNum(e.target.value)} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="DL123" required /></div></div>
              <div className="grid grid-cols-2 gap-4"><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Departing</label><input value={depAirport} onChange={e => setDepAirport(e.target.value)} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="MSP" maxLength={3} required /></div><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Arriving</label><input value={arrAirport} onChange={e => setArrAirport(e.target.value)} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="PHX" maxLength={3} required /></div></div>
              <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Date</label><div className="border rounded-lg p-1 bg-white"><DatePicker selected={flightDate} onChange={(date: Date | null) => setFlightDate(date)} className="w-full p-2 outline-none" placeholderText="Select Date" required /></div></div>
              <div className="grid grid-cols-2 gap-4"><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Depart Time</label><input type="time" value={depTime} onChange={e => setDepTime(e.target.value)} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-[#1a4d2e]" required /></div><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Arrive Time</label><input type="time" value={arrTime} onChange={e => setArrTime(e.target.value)} className="w-full border p-3 rounded-lg outline-none focus:ring-2 focus:ring-[#1a4d2e]" required /></div></div>
              <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100"><button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button><button type="submit" className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22]">Save Flight</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
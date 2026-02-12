'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { Lodging, Trip } from '../types'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TripLodging({ 
  tripId, 
  lodgings, 
  trip, 
  onUpdate 
}: { 
  tripId: string, 
  lodgings: Lodging[], 
  trip: Trip | null, 
  onUpdate: () => void 
}) {
  // --- STATE ---
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [url, setUrl] = useState('')
  const [checkInDate, setCheckInDate] = useState<Date | null>(null)
  const [checkInTime, setCheckInTime] = useState('15:00')
  const [checkOutDate, setCheckOutDate] = useState<Date | null>(null)
  const [checkOutTime, setCheckOutTime] = useState('11:00')

  // --- STATS ---
  let totalNights = 0
  if (trip) {
    const start = new Date(trip.start_date)
    const end = new Date(trip.end_date)
    totalNights = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
  }
  
  const coveredNights = lodgings.reduce((acc, lodge) => {
    const start = new Date(lodge.check_in_time)
    const end = new Date(lodge.check_out_time)
    const duration = Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    return acc + duration
  }, 0)

  // --- HANDLERS ---
  const handleOpenModal = (lodge?: Lodging) => {
    if (lodge) {
      setEditingId(lodge.id)
      setName(lodge.name)
      setAddress(lodge.street_address)
      setCity(lodge.city || '')
      setState(lodge.state || '')
      setZip(lodge.zip_code || '')
      setUrl(lodge.website_url || '')
      
      // FIX: Manually parse ISO strings to avoid timezone shift
      if (lodge.check_in_time) {
        const [dStr, tStr] = lodge.check_in_time.split('T')
        const [y, m, d] = dStr.split('-').map(Number)
        setCheckInDate(new Date(y, m - 1, d, 12, 0, 0))
        setCheckInTime(tStr.slice(0, 5))
      }

      if (lodge.check_out_time) {
        const [dStr, tStr] = lodge.check_out_time.split('T')
        const [y, m, d] = dStr.split('-').map(Number)
        setCheckOutDate(new Date(y, m - 1, d, 12, 0, 0))
        setCheckOutTime(tStr.slice(0, 5))
      }
    } else {
      setEditingId(null)
      setName(''); setAddress(''); setCity(''); setState(''); setZip(''); setUrl('')
      setCheckInDate(null); setCheckInTime('15:00')
      setCheckOutDate(null); setCheckOutTime('11:00')
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !checkInDate || !checkOutDate || !tripId) return

    // FIX: Use 'en-CA' for stable local YYYY-MM-DD
// Inside TripLodging.tsx -> handleSave

    // ... existing date string logic ...
    const checkInStr = checkInDate.toLocaleDateString('en-CA')
    const checkOutStr = checkOutDate.toLocaleDateString('en-CA')
    
    const fullCheckIn = `${checkInStr}T${checkInTime}:00`
    const fullCheckOut = `${checkOutStr}T${checkOutTime}:00`

    const payload = {
      trip_id: tripId,
      name: name,
      street_address: address,
      city: city,
      state: state,
      zip_code: zip,
      website_url: url,
      // FIX: Save BOTH the Timestamp AND the Date
      check_in_time: fullCheckIn,
      check_out_time: fullCheckOut,
      check_in_date: checkInStr,   // <--- Added
      check_out_date: checkOutStr  // <--- Added
    }

    if (editingId) {
      await supabase.from('trip_lodging').update(payload).eq('id', editingId)
    } else {
      await supabase.from('trip_lodging').insert(payload)
    }

    setShowModal(false)
    onUpdate()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this lodging?')) return
    await supabase.from('trip_lodging').delete().eq('id', id)
    onUpdate()
  }

  // --- HELPER: Timezone-Safe Formatting ---
  const formatDateTime = (iso: string) => {
    if (!iso) return { date: '—', time: '—' }
    
    const [datePart, timePart] = iso.split('T')
    if (!datePart || !timePart) return { date: '—', time: '—' }
    
    const [y, m, d] = datePart.split('-').map(Number)
    const [h, min] = timePart.split(':').map(Number)
    const localDate = new Date(y, m - 1, d, h, min)

    return {
      date: localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: localDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
  }

  const buildMapQuery = (lodge: Lodging) => {
    const parts = [lodge.street_address, lodge.city, lodge.state, lodge.zip_code].filter(Boolean)
    return encodeURIComponent(parts.join(', '))
  }

  return (
    <div className="p-8 max-w-5xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Lodging Logistics</h2>
        <p className="text-sm text-slate-500 mt-1">Manage hotels, houses, and check-in details.</p>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-[#1a4d2e]/10 flex items-center justify-center text-[#1a4d2e]"><span className="material-symbols-outlined text-2xl">nights_stay</span></div>
          <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Nights</p><p className="text-2xl font-bold text-slate-900">{totalNights} <span className="text-sm font-medium text-slate-500 font-normal">nights</span></p></div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4">
          <div className="w-12 h-12 rounded-lg bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37]"><span className="material-symbols-outlined text-2xl">bed</span></div>
          <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nights with Lodging</p><p className="text-2xl font-bold text-slate-900">{coveredNights} <span className="text-sm font-medium text-slate-500 font-normal">covered</span></p></div>
        </div>
      </div>

      {/* LIST */}
      <div className="flex flex-col gap-6">
        {lodgings.map((lodge) => (
          <div key={lodge.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group hover:border-[#1a4d2e]/50 transition-all hover:shadow-md">
            <div className="h-1.5 bg-[#1a4d2e]"></div>
            <div className="p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1a4d2e]">{lodge.name}</h2>
                  <div className="flex items-center text-slate-500 text-sm mt-1">
                    <span className="material-symbols-outlined text-lg mr-1 text-[#d4af37]">place</span>
                    <span>{lodge.street_address}{lodge.city ? `, ${lodge.city}` : ''}</span>
                    <a href={`https://www.google.com/maps/search/?api=1&query=$${buildMapQuery(lodge)}`} target="_blank" rel="noopener noreferrer" className="ml-3 text-[#1a4d2e] hover:underline text-xs font-semibold flex items-center transition-colors">View on Map <span className="material-symbols-outlined text-sm ml-0.5">open_in_new</span></a>
                  </div>
                  {lodge.website_url && (<div className="mt-1 flex items-center text-xs"><a href={lodge.website_url.startsWith('http') ? lodge.website_url : `https://${lodge.website_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-slate-400 hover:text-[#1a4d2e] transition-colors"><span className="material-symbols-outlined text-sm mr-1">link</span>{lodge.website_url.replace(/^https?:\/\//, '')}</a></div>)}
                </div>
                <div className="flex space-x-2 mt-4 md:mt-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(lodge)} className="p-2 text-slate-400 hover:text-[#1a4d2e] transition-colors bg-slate-50 hover:bg-slate-100 rounded-lg" title="Edit"><span className="material-symbols-outlined">edit</span></button>
                  <button onClick={() => handleDelete(lodge.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 hover:bg-red-50 rounded-lg" title="Delete"><span className="material-symbols-outlined">delete</span></button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1a4d2e] border border-slate-200 mr-4 shadow-sm"><span className="material-symbols-outlined text-xl">login</span></div>
                    <div><p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Check-In</p><div className="font-semibold text-slate-800 text-base">{formatDateTime(lodge.check_in_time).date} <span className="text-slate-400 font-normal mx-1">at</span> {formatDateTime(lodge.check_in_time).time}</div></div>
                  </div>
                  <div className="flex items-center bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#d4af37] border border-slate-200 mr-4 shadow-sm"><span className="material-symbols-outlined text-xl">logout</span></div>
                    <div><p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Check-Out</p><div className="font-semibold text-slate-800 text-base">{formatDateTime(lodge.check_out_time).date} <span className="text-slate-400 font-normal mx-1">at</span> {formatDateTime(lodge.check_out_time).time}</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <button onClick={() => handleOpenModal()} className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 hover:border-[#1a4d2e] transition-all cursor-pointer group w-full min-h-[160px]">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300 border border-slate-200 text-slate-400 group-hover:text-[#1a4d2e]"><span className="material-symbols-outlined text-3xl">add</span></div>
          <h3 className="text-lg font-bold text-slate-500 group-hover:text-[#1a4d2e] transition-colors">Add Accommodation</h3>
          <p className="text-slate-400 text-sm mt-1">Book hotels, houses, or airport stays</p>
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center gap-3"><span className="material-symbols-outlined text-[#1a4d2e]">hotel</span><h3 className="text-xl font-bold text-[#0d2818]">{editingId ? 'Edit Lodging' : 'Add Lodging'}</h3></div>
            <div className="p-6">
              <form onSubmit={handleSave} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Name</label><input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="e.g. Grand Resort" required /></div>
                <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Street Address</label><input value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="123 Fairway Dr" required /></div>
                <div className="grid grid-cols-12 gap-3">
                   <div className="col-span-6 flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">City</label><input value={city} onChange={e => setCity(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="Scottsdale" required /></div>
                   <div className="col-span-3 flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">State</label><input value={state} onChange={e => setState(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="AZ" required /></div>
                   <div className="col-span-3 flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Zip</label><input value={zip} onChange={e => setZip(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="85255" required /></div>
                </div>
                <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Website URL <span className="font-normal normal-case italic text-gray-400">(Optional)</span></label><input type="url" value={url} onChange={e => setUrl(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="https://airbnb.com/..." /></div>
                <div className="grid grid-cols-2 gap-4"><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Check-In Date</label><div className="border border-gray-200 rounded-lg p-1 bg-white focus-within:ring-2 focus-within:ring-[#1a4d2e]"><DatePicker selected={checkInDate} onChange={(date: Date | null) => setCheckInDate(date)} className="w-full p-2 outline-none" placeholderText="Select Date" required /></div></div><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Check-In Time</label><input type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" required /></div></div>
                <div className="grid grid-cols-2 gap-4"><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Check-Out Date</label><div className="border border-gray-200 rounded-lg p-1 bg-white focus-within:ring-2 focus-within:ring-[#1a4d2e]"><DatePicker selected={checkOutDate} onChange={(date: Date | null) => setCheckOutDate(date)} className="w-full p-2 outline-none" placeholderText="Select Date" required /></div></div><div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Check-Out Time</label><input type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" required /></div></div>
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100"><button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button><button type="submit" className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22]">Save Lodging</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
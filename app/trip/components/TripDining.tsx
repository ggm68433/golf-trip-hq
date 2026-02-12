'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { Dining } from '../types'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TripDining({ 
  tripId, 
  dinings, 
  onUpdate 
}: { 
  tripId: string, 
  dinings: Dining[], 
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
  const [date, setDate] = useState<Date | null>(null)
  const [time, setTime] = useState('19:00')
  const [partySize, setPartySize] = useState('')

  // --- STATS ---
  const totalReservations = dinings.length

  // --- HANDLERS ---
  const handleOpenModal = (dining?: Dining) => {
    if (dining) {
      setEditingId(dining.id)
      setName(dining.name)
      setAddress(dining.street_address)
      setCity(dining.city || '')
      setState(dining.state || '')
      setZip(dining.zip_code || '')
      setUrl(dining.website_url || '')
      setPartySize(dining.party_size.toString())
      
      // FIX: Manually parse string to avoid Timezone Shift
      // DB Format: "2026-02-12T20:00:00+00:00"
      if (dining.reservation_time) {
        const [rawDate, rawTime] = dining.reservation_time.split('T')
        const [y, m, d] = rawDate.split('-').map(Number)
        
        // Create date as Local Noon to avoid rollover issues
        setDate(new Date(y, m - 1, d, 12, 0, 0))
        
        // Extract "20:00" directly from string
        setTime(rawTime.slice(0, 5))
      }
    } else {
      setEditingId(null)
      setName(''); setAddress(''); setCity(''); setState(''); setZip(''); setUrl(''); setPartySize('')
      setDate(null); setTime('19:00')
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !date || !tripId) return

    // Create "YYYY-MM-DD" in local time
    const dateStr = date.toLocaleDateString('en-CA')
    const fullTimestamp = `${dateStr}T${time}:00`

    const payload = {
      trip_id: tripId,
      name: name,
      street_address: address,
      city: city,
      state: state,
      zip_code: zip,
      website_url: url,
      reservation_time: fullTimestamp,
      party_size: partySize ? parseInt(partySize) : 0
    }

    let result
    if (editingId) {
      result = await supabase.from('trip_dining').update(payload).eq('id', editingId).select()
    } else {
      result = await supabase.from('trip_dining').insert(payload).select()
    }

    const { error } = result

    if (error) {
      console.error("Save failed:", error.message)
      alert(`Failed to save: ${error.message}`)
    } else {
      setShowModal(false)
      onUpdate()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this reservation?')) return
    await supabase.from('trip_dining').delete().eq('id', id)
    onUpdate()
  }

  // --- HELPER: TIMEZONE-SAFE FORMATTER ---
  const formatDateTime = (iso: string) => {
    if (!iso) return { date: '—', time: '—' }

    // Split "2026-02-12T20:00:00" directly
    const [datePart, timePart] = iso.split('T')
    if (!datePart || !timePart) return { date: '—', time: '—' }

    const [y, m, d] = datePart.split('-').map(Number)
    const [h, min] = timePart.split(':').map(Number)

    // Create a generic Date object using the exact numbers we see
    // This tricks the browser into displaying exactly what we stored
    const localDate = new Date(y, m - 1, d, h, min)

    return {
      date: localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: localDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
  }

  const buildAddressQuery = (street: string, city?: string, state?: string, zip?: string) => {
    const parts = [street, city, state, zip].filter(Boolean)
    return encodeURIComponent(parts.join(', '))
  }

  return (
    <div className="p-8 max-w-5xl mx-auto pb-20">
      
      {/* HEADER */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Dining Reservations</h2>
        <p className="text-sm text-slate-500 mt-1">Manage restaurant bookings and group meals.</p>
      </div>

      {/* STATS (Single Card) */}
      <div className="mb-8">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center space-x-4 max-w-md">
          <div className="w-12 h-12 rounded-lg bg-[#1a4d2e]/10 flex items-center justify-center text-[#1a4d2e]">
            <span className="material-symbols-outlined text-2xl">restaurant</span>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Reservations</p>
            <p className="text-2xl font-bold text-slate-900">{totalReservations}</p>
          </div>
        </div>
      </div>

      {/* LIST */}
      <div className="flex flex-col gap-6">
        {dinings.map((dining) => (
          <div key={dining.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden group hover:border-[#1a4d2e]/50 transition-all hover:shadow-md">
            <div className="h-1.5 bg-[#1a4d2e]"></div>
            <div className="p-6">
              
              {/* Top Row: Name & Actions */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#1a4d2e]">{dining.name}</h2>
                  
                  {/* Address Line */}
                  <div className="flex items-center text-slate-500 text-sm mt-1">
                    <span className="material-symbols-outlined text-lg mr-1 text-[#d4af37]">place</span>
                    <span>{dining.street_address}{dining.city ? `, ${dining.city}` : ''}</span>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=$${buildAddressQuery(dining.street_address, dining.city, dining.state, dining.zip_code)}`} 
                      target="_blank" rel="noopener noreferrer"
                      className="ml-3 text-[#1a4d2e] hover:underline text-xs font-semibold flex items-center transition-colors"
                    >
                      View on Map <span className="material-symbols-outlined text-sm ml-0.5">open_in_new</span>
                    </a>
                  </div>

                  {/* Website Line */}
                  {dining.website_url && (
                    <div className="mt-1 flex items-center text-xs">
                      <a href={dining.website_url.startsWith('http') ? dining.website_url : `https://${dining.website_url}`} target="_blank" rel="noopener noreferrer" className="flex items-center text-slate-400 hover:text-[#1a4d2e] transition-colors">
                        <span className="material-symbols-outlined text-sm mr-1">link</span>
                        {dining.website_url.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>

                {/* Actions (Visible on Hover) */}
                <div className="flex space-x-2 mt-4 md:mt-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleOpenModal(dining)} className="p-2 text-slate-400 hover:text-[#1a4d2e] transition-colors bg-slate-50 hover:bg-slate-100 rounded-lg" title="Edit"><span className="material-symbols-outlined">edit</span></button>
                  <button onClick={() => handleDelete(dining.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 hover:bg-red-50 rounded-lg" title="Delete"><span className="material-symbols-outlined">delete</span></button>
                </div>
              </div>
              
              {/* Bottom Row: Date/Time Grid */}
              <div className="border-t border-slate-100 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Reservation Time */}
                  <div className="flex items-center bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1a4d2e] border border-slate-200 mr-4 shadow-sm">
                      <span className="material-symbols-outlined text-xl">event</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Reservation</p>
                      <div className="font-semibold text-slate-800 text-base">
                        {formatDateTime(dining.reservation_time).date} <span className="text-slate-400 font-normal mx-1">at</span> {formatDateTime(dining.reservation_time).time}
                      </div>
                    </div>
                  </div>

                  {/* Party Size */}
                  <div className="flex items-center bg-slate-50 rounded-lg p-4 border border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#d4af37] border border-slate-200 mr-4 shadow-sm">
                      <span className="material-symbols-outlined text-xl">groups</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">Party Size</p>
                      <div className="font-semibold text-slate-800 text-base">
                        {dining.party_size} <span className="text-slate-400 font-normal">Guests</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        ))}

        {/* SHADOW CARD (Add Reservation) */}
        <button 
          onClick={() => handleOpenModal()} 
          className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 hover:border-[#1a4d2e] transition-all cursor-pointer group w-full min-h-[160px]"
        >
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform duration-300 border border-slate-200 text-slate-400 group-hover:text-[#1a4d2e]">
            <span className="material-symbols-outlined text-3xl">add</span>
          </div>
          <h3 className="text-lg font-bold text-slate-500 group-hover:text-[#1a4d2e] transition-colors">Add Reservation</h3>
          <p className="text-slate-400 text-sm mt-1">Book dinners, lunches, or events</p>
        </button>

      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
            
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <span className="material-symbols-outlined text-[#1a4d2e]">restaurant</span>
              <h3 className="text-xl font-bold text-[#0d2818]">{editingId ? 'Edit Reservation' : 'Add Reservation'}</h3>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleSave} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-gray-500">Restaurant Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="e.g. Steakhouse 44" required />
                </div>

                <div className="grid grid-cols-12 gap-3">
                   <div className="col-span-5 flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase text-gray-500">Date</label>
                      <div className="border border-gray-200 rounded-lg p-1 bg-white focus-within:ring-2 focus-within:ring-[#1a4d2e]"><DatePicker selected={date} onChange={(d: Date | null) => setDate(d)} className="w-full p-2 outline-none" placeholderText="Select" required /></div>
                   </div>
                   <div className="col-span-4 flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase text-gray-500">Time</label>
                      <input type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" required />
                   </div>
                   <div className="col-span-3 flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase text-gray-500">Guests</label>
                      <input type="number" value={partySize} onChange={e => setPartySize(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="4" required />
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase text-gray-500">Street Address</label>
                  <input value={address} onChange={e => setAddress(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="123 Main St" required />
                </div>

                <div className="grid grid-cols-12 gap-3">
                   <div className="col-span-6 flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase text-gray-500">City</label>
                      <input value={city} onChange={e => setCity(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="City" required />
                   </div>
                   <div className="col-span-3 flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase text-gray-500">State</label>
                      <input value={state} onChange={e => setState(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="ST" required />
                   </div>
                   <div className="col-span-3 flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase text-gray-500">Zip</label>
                      <input value={zip} onChange={e => setZip(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="Zip" required />
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                   <label className="text-xs font-bold uppercase text-gray-500">Website URL <span className="font-normal normal-case italic text-gray-400">(Optional)</span></label>
                   <input type="url" value={url} onChange={e => setUrl(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="https://..." />
                </div>

                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22]">Save Reservation</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Golfer } from '../types'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function TripRoster({ 
  tripId, 
  golfers, 
  tripOwnerId, 
  onUpdate 
}: { 
  tripId: string, 
  golfers: Golfer[], 
  tripOwnerId?: string, 
  // Dates removed from props as requested
  onUpdate: () => void 
}) {
  // --- STATE ---
  const [showAddModal, setShowAddModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  
  // Add Form
  const [newName, setNewName] = useState('')
  const [newHcp, setNewHcp] = useState('')

  // Invite Form
  const [inviteId, setInviteId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')

  // --- ACTIONS ---
// ... imports

  const handleAddGolfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !tripId) return

    const { error } = await supabase.from('trip_golfers').insert({
      trip_id: tripId, 
      name: newName, 
      // FIX: Round the handicap because DB column is 'smallint' (integer)
      // If you want decimals, you must change your DB column to 'numeric'
      handicap: newHcp ? parseFloat(newHcp) : 0 
    })

    if (error) {
      // FIX: Alert the user if something goes wrong
      console.error(error)
      alert(`Failed to add golfer: ${error.message}`)
    } else {
      setNewName('')
      setNewHcp('')
      setShowAddModal(false)
      onUpdate()
    }
  }

// ... rest of component

  const handleOpenInvite = (golferId: string) => {
    setInviteId(golferId)
    setInviteEmail('')
    setShowInviteModal(true)
  }

// Inside components/TripRoster.tsx

// ... inside handleInvite function ...
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteId || !inviteEmail) return

    // 1. Call your API
// Inside handleInvite...
const response = await fetch('/api/invite', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: inviteEmail,
    tripId: tripId,
    golferId: inviteId,
    name: golfers.find(g => g.id === inviteId)?.name || 'Golfer',
    // ADD THIS LINE:
    tripName: 'Your Golf Trip' // Ideally pass the real trip name prop if available, or just a static string for now
  })
})

    const result = await response.json()

    if (!response.ok) {
      alert(`Error: ${result.error}`)
    } else {
      // 2. Optimistic Update (Optional, but good UX)
      setShowInviteModal(false)
      onUpdate() // Refresh list to show "Pending" status if you add that logic
      alert(`Invite sent to ${inviteEmail}!`)
    }
  }

  // --- HELPERS ---
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8 pb-20">
      
      {/* --- HYBRID HEADER: Title Only (No Dates, No Button) --- */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Trip Roster</h2>
        <p className="text-sm text-slate-500 mt-1">Manage attendees and handicaps</p>
      </div>

      {/* GRID LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        
        {/* EXISTING GOLFERS */}
        {golfers.map((golfer) => {
          const isOrganizer = tripOwnerId && tripOwnerId === golfer.user_id
          const displayName = golfer.profile_name || golfer.name
          
          return (
            <div key={golfer.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center hover:shadow-md transition-shadow group relative">
              
              {/* Edit Icon (Hidden until hover) */}
              <div className="absolute top-4 right-4 text-[#1a4d2e] opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="material-symbols-outlined cursor-pointer text-xl">edit</span>
              </div>

              {/* Avatar */}
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border-2 ${isOrganizer ? 'bg-[#1a4d2e]/10 border-[#f2d00d]/20 text-[#1a4d2e]' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                <span className="text-2xl font-bold tracking-wide">{getInitials(displayName)}</span>
              </div>

              {/* Name & Role */}
              <h3 className="text-lg font-bold text-slate-900">{displayName}</h3>
              <span className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isOrganizer ? 'text-[#d4b60b]' : 'text-slate-400'}`}>
                {isOrganizer ? 'Organizer' : 'Member'}
              </span>

              {/* Bottom Split: HCP vs Status */}
              <div className="w-full grid grid-cols-2 gap-2 text-center mt-2 pt-4 border-t border-slate-100">
                {/* Left: Handicap */}
                <div>
                  <p className="text-2xl font-bold text-slate-800">{golfer.handicap}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">HCP</p>
                </div>

                {/* Right: Status/Invite */}
                <div className="border-l border-slate-100 flex flex-col items-center justify-center">
                  {golfer.user_id ? ( 
                    <div className="flex flex-col items-center">
                      <span className="material-symbols-outlined text-[#1a4d2e] text-xl">verified</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a4d2e] mt-1">Verified</span>
                    </div>
                  ) : golfer.email ? (
                    <button onClick={() => handleOpenInvite(golfer.id)} className="flex flex-col items-center hover:opacity-75">
                      <span className="material-symbols-outlined text-amber-500 text-xl">schedule</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mt-1">Pending</span>
                    </button>
                  ) : (
                    <button onClick={() => handleOpenInvite(golfer.id)} className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full transition-colors">
                      <span className="material-symbols-outlined text-xs">add</span> Invite
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* SHADOW CARD (ADD GOLFER) - This is now the main "Add" button */}
        <button onClick={() => setShowAddModal(true)} className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center hover:border-[#1a4d2e] hover:bg-slate-100 transition-all group min-h-[280px]">
          <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-slate-400 group-hover:text-[#1a4d2e] text-3xl">add</span>
          </div>
          <h3 className="text-lg font-bold text-slate-500 group-hover:text-[#1a4d2e]">Add Golfer</h3>
          <p className="text-sm text-slate-400 mt-2">Invite new participant</p>
        </button>

      </div>

      {/* --- MODAL: ADD GOLFER --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowAddModal(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]">
            <div className="p-6">
              <h3 className="text-xl font-bold text-[#0d2818] mb-4">Add New Golfer</h3>
              <form onSubmit={handleAddGolfer} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Name</label>
                  <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="e.g. Rory McIlroy" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Handicap</label>
                  <input type="number" step="0.1" value={newHcp} onChange={e => setNewHcp(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="0.0" />
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22]">Add Golfer</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: INVITE --- */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowInviteModal(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><span className="material-symbols-outlined">mail</span></div>
                <h3 className="text-xl font-bold text-[#0d2818]">Invite Golfer</h3>
              </div>
              <p className="text-sm text-slate-500 mb-6">Enter their email to invite them to this trip. If they already have an account, they'll be linked instantly.</p>
              <form onSubmit={handleInvite} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Email Address</label>
                  <input autoFocus type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="golfer@example.com" required />
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22]">Send Invite</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
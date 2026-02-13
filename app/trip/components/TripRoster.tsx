'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Golfer } from '../types'

export default function TripRoster({ 
  tripId, 
  golfers, 
  tripOwnerId, 
  tripName, 
  onUpdate 
}: { 
  tripId: string, 
  golfers: Golfer[], 
  tripOwnerId?: string, 
  tripName?: string, 
  onUpdate: () => void 
}) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // --- MODAL STATE ---
  const [showModal, setShowModal] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  
  // --- FORM STATE ---
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formHcp, setFormHcp] = useState('')

  // --- INVITE STATE ---
  const [inviteId, setInviteId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sending, setSending] = useState(false)

  // --- ACTIONS ---

  const handleOpenAdd = () => {
    setEditingId(null)
    setFormName('')
    setFormHcp('')
    setShowModal(true)
  }

  const handleOpenEdit = (golfer: Golfer) => {
    setEditingId(golfer.id)
    setFormName(golfer.name)
    setFormHcp(golfer.handicap.toString())
    setShowModal(true)
  }

  const handleSaveGolfer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName || !tripId) return

    const payload = {
      name: formName,
      handicap: formHcp ? parseFloat(formHcp) : 0
    }

    let error

    if (editingId) {
      // EDIT EXISTING
      const { error: updateError } = await supabase
        .from('trip_golfers')
        .update(payload)
        .eq('id', editingId)
      error = updateError
    } else {
      // ADD NEW
      const { error: insertError } = await supabase
        .from('trip_golfers')
        .insert({
          trip_id: tripId,
          status: null, // <--- CRITICAL FIX: Set to null so "Invite" button appears
          ...payload
        })
      error = insertError
    }

    if (error) {
      alert(`Failed to save golfer: ${error.message}`)
    } else {
      setShowModal(false)
      onUpdate()
    }
  }

  const handleDelete = async () => {
    if (!editingId || !confirm('Are you sure you want to remove this golfer?')) return
    
    const { error } = await supabase
      .from('trip_golfers')
      .delete()
      .eq('id', editingId)

    if (error) {
      alert(`Error deleting: ${error.message}`)
    } else {
      setShowModal(false)
      onUpdate()
    }
  }

  const handleOpenInvite = (golferId: string) => {
    setInviteId(golferId)
    setInviteEmail('')
    setShowInviteModal(true)
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteId || !inviteEmail) return
    
    setSending(true)

    try {
      const response = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail,
          tripId: tripId,
          golferId: inviteId,
          name: golfers.find(g => g.id === inviteId)?.name || 'Golfer',
          tripName: tripName || 'Golf Trip'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        alert(`Error: ${result.error}`)
      } else {
        setShowInviteModal(false)
        onUpdate()
        alert(`Invite sent to ${inviteEmail}!`)
      }
    } catch (err) {
      alert('Network error sending invite')
    } finally {
      setSending(false)
    }
  }

  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()

  return (
    <div className="p-8 max-w-7xl mx-auto flex flex-col gap-8 pb-20">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Trip Roster</h2>
        <p className="text-sm text-slate-500 mt-1">Manage attendees and handicaps</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {golfers.map((golfer) => {
          const isOrganizer = tripOwnerId && tripOwnerId === golfer.user_id
          const displayName = golfer.profile_name || golfer.name
          
          return (
            <div key={golfer.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center hover:shadow-md transition-shadow group relative">
              
              {/* EDIT BUTTON (Top Right) */}
              <button 
                onClick={() => handleOpenEdit(golfer)}
                className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-[#1a4d2e] hover:bg-slate-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                title="Edit Golfer"
              >
                <span className="material-symbols-outlined text-lg">edit</span>
              </button>

              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 border-2 ${isOrganizer ? 'bg-[#1a4d2e]/10 border-[#f2d00d]/20 text-[#1a4d2e]' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                <span className="text-2xl font-bold tracking-wide">{getInitials(displayName)}</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">{displayName}</h3>
              <span className={`text-xs font-semibold uppercase tracking-wider mb-4 ${isOrganizer ? 'text-[#d4b60b]' : 'text-slate-400'}`}>
                {isOrganizer ? 'Organizer' : 'Member'}
              </span>
              <div className="w-full grid grid-cols-2 gap-2 text-center mt-2 pt-4 border-t border-slate-100">
                <div>
                  <p className="text-2xl font-bold text-slate-800">{golfer.handicap}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">HCP</p>
                </div>
                
                {/* STATUS INDICATOR LOGIC */}
                <div className="border-l border-slate-100 flex flex-col items-center justify-center">
                  {golfer.status === 'invited' ? (
                    /* CASE 1: PENDING (Email Sent) */
                    <button onClick={() => handleOpenInvite(golfer.id)} className="flex flex-col items-center hover:opacity-75 group">
                      <div className="flex items-center gap-1 mb-1">
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Pending</span>
                      </div>
                      <span className="text-[10px] text-slate-400 group-hover:text-amber-500 transition-colors">Resend?</span>
                    </button>
                  ) : golfer.user_id ? ( 
                    /* CASE 2: VERIFIED (Joined) */
                    <div className="flex flex-col items-center">
                      <span className="material-symbols-outlined text-[#1a4d2e] text-xl">verified</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#1a4d2e] mt-1">Verified</span>
                    </div>
                  ) : (
                    /* CASE 3: NO STATUS (Manual Add) */
                    <button onClick={() => handleOpenInvite(golfer.id)} className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold uppercase px-3 py-1.5 rounded-full transition-colors">
                      <span className="material-symbols-outlined text-xs">add</span> Invite
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* ADD BUTTON */}
        <button onClick={handleOpenAdd} className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center justify-center hover:border-[#1a4d2e] hover:bg-slate-100 transition-all group min-h-[280px]">
          <div className="w-16 h-16 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-slate-400 group-hover:text-[#1a4d2e] text-3xl">add</span>
          </div>
          <h3 className="text-lg font-bold text-slate-500 group-hover:text-[#1a4d2e]">Add Golfer</h3>
          <p className="text-sm text-slate-400 mt-2">Invite new participant</p>
        </button>
      </div>

      {/* --- MODAL: ADD / EDIT GOLFER --- */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-[#0d2818]">{editingId ? 'Edit Golfer' : 'Add New Golfer'}</h3>
              {editingId && (
                <button onClick={handleDelete} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Delete Golfer">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              )}
            </div>
            <div className="p-6">
              <form onSubmit={handleSaveGolfer} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Name</label>
                  <input autoFocus value={formName} onChange={e => setFormName(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="e.g. Rory McIlroy" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Handicap</label>
                  <input type="number" step="0.1" value={formHcp} onChange={e => setFormHcp(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="0.0" />
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                  <button type="submit" className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22]">
                    {editingId ? 'Save Changes' : 'Add Golfer'}
                  </button>
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
              <p className="text-sm text-slate-500 mb-6">Enter their email. We'll send them a secure magic link to join this trip instantly.</p>
              <form onSubmit={handleInvite} className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Email Address</label>
                  <input autoFocus type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="golfer@example.com" required />
                </div>
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button>
                  <button type="submit" disabled={sending} className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22] disabled:opacity-50">
                    {sending ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
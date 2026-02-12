'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import DatePicker from 'react-datepicker'
import "react-datepicker/dist/react-datepicker.css"
import { Expense, Golfer } from '../types'

const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Helper to calculate debts
type Debt = {
  from: string;
  to: string;
  amount: number;
}

export default function TripExpenses({ 
  tripId, 
  expenses, 
  golfers,
  onUpdate 
}: { 
  tripId: string, 
  expenses: Expense[], 
  golfers: Golfer[],
  onUpdate: () => void 
}) {
  // --- STATE ---
  const [view, setView] = useState<'ledger' | 'balances'>('ledger')
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Form State
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState('')
  const [date, setDate] = useState<Date | null>(new Date())
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>('equal')
  const [selectedGolferIds, setSelectedGolferIds] = useState<string[]>([])

  // --- EFFECT: Set Default Payer ---
  useEffect(() => {
    if (golfers.length > 0 && !payerId) {
      setPayerId(golfers[0].id)
    }
  }, [golfers, payerId])

  // --- CALCULATE BALANCES ---
  const calculateBalances = () => {
    // 1. Net Balance per person (positive = owed money, negative = owes money)
    const balances: Record<string, number> = {}
    golfers.forEach(g => balances[g.id] = 0)

    expenses.forEach(expense => {
      // Add amount to payer
      balances[expense.payer_id] = (balances[expense.payer_id] || 0) + expense.amount

      // Subtract from splitters
      const splitters = expense.split_method === 'custom' && expense.split_among 
        ? expense.split_among 
        : golfers.map(g => g.id)
      
      const splitAmount = expense.amount / (splitters.length || 1)
      
      splitters.forEach(id => {
        balances[id] = (balances[id] || 0) - splitAmount
      })
    })

    // 2. Simplify Debts
    const debts: Debt[] = []
    const debtors = Object.entries(balances).filter(([, bal]) => bal < -0.01).sort((a, b) => a[1] - b[1]) // Most negative first
    const creditors = Object.entries(balances).filter(([, bal]) => bal > 0.01).sort((a, b) => b[1] - a[1]) // Most positive first

    let i = 0; let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const [debtorId, debtorBal] = debtors[i]
      const [creditorId, creditorBal] = creditors[j]
      
      const amount = Math.min(Math.abs(debtorBal), creditorBal)
      debts.push({ from: debtorId, to: creditorId, amount })

      // Update remaining
      debtors[i][1] += amount
      creditors[j][1] -= amount

      if (Math.abs(debtors[i][1]) < 0.01) i++
      if (Math.abs(creditors[j][1]) < 0.01) j++
    }

    return debts
  }

  const debts = calculateBalances()

  // --- HANDLERS ---
  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditingId(expense.id)
      setDescription(expense.description)
      setAmount(expense.amount.toString())
      setPayerId(expense.payer_id)
      setSplitMethod((expense.split_method as 'equal' | 'custom') || 'equal')
      
      if (expense.expense_date) {
        const [y, m, d] = expense.expense_date.split('-').map(Number)
        setDate(new Date(y, m - 1, d, 12, 0, 0))
      }
      
      if (expense.split_among && expense.split_among.length > 0) {
        setSelectedGolferIds(expense.split_among)
      } else {
        setSelectedGolferIds(golfers.map(g => g.id))
      }
    } else {
      setEditingId(null)
      setDescription('')
      setAmount('')
      setPayerId(golfers[0]?.id || '')
      setSplitMethod('equal')
      setDate(new Date())
      setSelectedGolferIds(golfers.map(g => g.id))
    }
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!tripId || !description || !amount || !date || !payerId) return alert("Please fill in all required fields.")

    const dateStr = date.toLocaleDateString('en-CA')

    const payload = {
      trip_id: tripId,
      description: description,
      amount: parseFloat(amount),
      payer_id: payerId,
      expense_date: dateStr,
      split_method: splitMethod,
      split_among: splitMethod === 'custom' ? selectedGolferIds : null
    }

    let result
    if (editingId) {
      result = await supabase.from('trip_expenses').update(payload).eq('id', editingId).select()
    } else {
      result = await supabase.from('trip_expenses').insert(payload).select()
    }

    const { data, error } = result

    if (error) {
      console.error("Supabase Error:", error)
      alert(`Save Failed: ${error.message}`)
    } else if (!data || data.length === 0) {
      alert("Save Failed: Database permission denied (RLS).")
    } else {
      setShowModal(false)
      onUpdate()
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    await supabase.from('trip_expenses').delete().eq('id', id)
    onUpdate()
  }

  const toggleGolferSelection = (id: string) => {
    if (selectedGolferIds.includes(id)) {
      setSelectedGolferIds(selectedGolferIds.filter(g => g !== id))
    } else {
      setSelectedGolferIds([...selectedGolferIds, id])
    }
  }

  // --- HELPERS ---
  const getGolferName = (id: string) => golfers.find(g => g.id === id)?.name || 'Unknown'
  const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  
  const formatDate = (iso: string) => {
    if (!iso) return '—'
    const [y, m, d] = iso.split('-').map(Number)
    const localDate = new Date(y, m - 1, d, 12, 0, 0)
    return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="p-8 max-w-5xl mx-auto pb-20">
      
      {/* HEADER + TOGGLE */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Trip Expenses</h2>
          <p className="text-sm text-slate-500 mt-1">Track shared costs and settle up.</p>
        </div>
        
        {/* VIEW TOGGLE */}
        <div className="flex bg-slate-200 p-1 rounded-lg">
          <button 
            onClick={() => setView('ledger')} 
            className={`px-6 py-2 text-sm font-bold rounded-md transition-all ${view === 'ledger' ? 'bg-white text-[#1a4d2e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Ledger
          </button>
          <button 
            onClick={() => setView('balances')} 
            className={`px-6 py-2 text-sm font-bold rounded-md transition-all ${view === 'balances' ? 'bg-white text-[#1a4d2e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Balances
          </button>
        </div>
      </div>

      {/* --- LEDGER VIEW --- */}
      {view === 'ledger' && (
        <div className="flex flex-col gap-4">
          {expenses.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <p className="text-slate-400 font-medium">No expenses recorded yet.</p>
            </div>
          ) : (
            expenses.map((expense) => (
              <div key={expense.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between group hover:border-[#1a4d2e]/50 transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-100">
                    <span className="material-symbols-outlined">receipt_long</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">{expense.description}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                      <span className="font-medium text-slate-700">Paid by {getGolferName(expense.payer_id)}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span>{formatDate(expense.expense_date)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xl font-bold text-[#1a4d2e]">${expense.amount.toFixed(2)}</p>
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-wide">{expense.split_method}</p>
                  </div>
                  <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(expense)} className="p-2 text-slate-400 hover:text-[#1a4d2e] transition-colors bg-slate-50 hover:bg-slate-100 rounded-lg"><span className="material-symbols-outlined text-lg">edit</span></button>
                    <button onClick={() => handleDelete(expense.id)} className="p-2 text-slate-400 hover:text-red-500 transition-colors bg-slate-50 hover:bg-red-50 rounded-lg"><span className="material-symbols-outlined text-lg">delete</span></button>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* SHADOW CARD (Add Expense) */}
          <button 
            onClick={() => handleOpenModal()} 
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center bg-slate-50/50 hover:bg-slate-50 hover:border-[#1a4d2e] transition-all cursor-pointer group w-full min-h-[140px] mt-4"
          >
            <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-110 transition-transform duration-300 border border-slate-200 text-slate-400 group-hover:text-[#1a4d2e]">
              <span className="material-symbols-outlined text-3xl">add</span>
            </div>
            <h3 className="text-lg font-bold text-slate-500 group-hover:text-[#1a4d2e] transition-colors">Add Expense</h3>
          </button>
        </div>
      )}

      {/* --- BALANCES VIEW --- */}
      {view === 'balances' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {debts.length === 0 ? (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                <span className="material-symbols-outlined text-3xl">check</span>
              </div>
              <h3 className="text-lg font-bold text-slate-900">All Settled Up!</h3>
              <p className="text-slate-500 mt-1">No debts found based on current expenses.</p>
            </div>
          ) : (
            debts.map((debt, i) => (
              <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-green-400"></div>
                
                {/* Avatar Pair */}
                <div className="flex items-center gap-4 mb-4 mt-2">
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 border border-slate-200 mb-1">{getInitials(getGolferName(debt.from))}</div>
                    <span className="text-xs font-bold text-slate-900">{getGolferName(debt.from).split(' ')[0]}</span>
                  </div>
                  <div className="flex flex-col items-center text-slate-400">
                    <span className="text-[10px] font-bold uppercase tracking-wider mb-1">Pays</span>
                    <span className="material-symbols-outlined text-2xl">arrow_forward</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-[#1a4d2e] flex items-center justify-center text-xs font-bold text-white border border-[#1a4d2e] mb-1">{getInitials(getGolferName(debt.to))}</div>
                    <span className="text-xs font-bold text-slate-900">{getGolferName(debt.to).split(' ')[0]}</span>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-full px-4 py-1 border border-slate-200">
                  <span className="text-xl font-bold text-slate-900">${debt.amount.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-[fadeInUp_0.2s_ease-out]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-100 flex items-center gap-3"><span className="material-symbols-outlined text-[#1a4d2e]">payments</span><h3 className="text-xl font-bold text-[#0d2818]">{editingId ? 'Edit Expense' : 'Add Expense'}</h3></div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <form onSubmit={handleSave} className="flex flex-col gap-5">
                <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Description</label><input value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="e.g. Airbnb Deposit" required /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Amount ($)</label><input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e]" placeholder="0.00" required /></div>
                  <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Date</label><div className="border border-gray-200 rounded-lg p-1 bg-white focus-within:ring-2 focus-within:ring-[#1a4d2e]"><DatePicker selected={date} onChange={(d: Date | null) => setDate(d)} className="w-full p-2 outline-none" placeholderText="Select Date" required /></div></div>
                </div>
                <div className="flex flex-col gap-2"><label className="text-xs font-bold uppercase text-gray-500">Paid By</label><select value={payerId} onChange={e => setPayerId(e.target.value)} className="w-full border border-gray-200 rounded-lg p-3 outline-none focus:ring-2 focus:ring-[#1a4d2e] bg-white">{golfers.length === 0 && <option value="">No golfers found</option>}{golfers.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}</select></div>
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-bold uppercase text-gray-500">Split Method</label>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button type="button" onClick={() => setSplitMethod('equal')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${splitMethod === 'equal' ? 'bg-white text-[#1a4d2e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Split Equally</button>
                    <button type="button" onClick={() => setSplitMethod('custom')} className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${splitMethod === 'custom' ? 'bg-white text-[#1a4d2e] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Select Golfers</button>
                  </div>
                </div>
                {splitMethod === 'custom' && (
                  <div className="flex flex-col gap-2 border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto">
                    {golfers.map(g => (
                      <div key={g.id} onClick={() => toggleGolferSelection(g.id)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${selectedGolferIds.includes(g.id) ? 'bg-[#1a4d2e]/10' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedGolferIds.includes(g.id) ? 'bg-[#1a4d2e] text-white' : 'bg-slate-200 text-slate-500'}`}>{getInitials(g.name)}</div><span className={`text-sm font-medium ${selectedGolferIds.includes(g.id) ? 'text-[#1a4d2e]' : 'text-slate-600'}`}>{g.name}</span></div>
                        {selectedGolferIds.includes(g.id) && <span className="material-symbols-outlined text-[#1a4d2e] text-lg">check_circle</span>}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 mt-2 pt-4 border-t border-gray-100"><button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-lg">Cancel</button><button type="submit" className="flex-1 py-3 bg-[#1a4d2e] text-white font-bold rounded-lg hover:bg-[#143a22]">Save Expense</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
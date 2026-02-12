'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Golfer {
  id: string
  name: string
}

interface Expense {
  id: string
  description: string
  amount: number
  expense_date: string
  payer_id: string
  split_among: string[] | null
  trip_golfers: { name: string }
}

interface Props {
  tripId: string
}

export default function ExpenseTracker({ tripId }: Props) {
  const [activeTab, setActiveTab] = useState<'ledger' | 'balances'>('ledger')
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [golfers, setGolfers] = useState<Golfer[]>([])
  const [loading, setLoading] = useState(false)

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [payerId, setPayerId] = useState('')
  
  // Split Logic
  const [splitWith, setSplitWith] = useState<string[]>([]) 

  useEffect(() => {
    fetchData()
  }, [tripId])

  const fetchData = async () => {
    // 1. Get Roster
    const { data: rosterData } = await supabase
      .from('trip_golfers')
      .select('id, name')
      .eq('trip_id', tripId)
      .order('name')
    if (rosterData) setGolfers(rosterData)

    // 2. Get Expenses
    const { data: expenseData } = await supabase
      .from('trip_expenses')
      .select(`*, trip_golfers (name)`)
      .eq('trip_id', tripId)
      .order('expense_date', { ascending: false })

    if (expenseData) setExpenses(expenseData as any)
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description || !amount || !payerId) return alert('Please fill in all fields')

    setLoading(true)
    
    const isEveryone = splitWith.length === 0 || splitWith.length === golfers.length
    const splitData = isEveryone ? null : splitWith

    const { error } = await supabase.from('trip_expenses').insert([{
      trip_id: tripId,
      payer_id: payerId,
      description,
      amount: parseFloat(amount),
      split_among: splitData,
      expense_date: new Date().toISOString()
    }])

    if (error) {
      alert('Error adding expense')
    } else {
      resetForm()
      fetchData()
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    await supabase.from('trip_expenses').delete().eq('id', id)
    fetchData()
  }

  const resetForm = () => {
    setDescription('')
    setAmount('')
    setPayerId('')
    setSplitWith([])
    setIsFormOpen(false)
  }

  // --- SETTLEMENT MATH ---
  const calculateBalances = () => {
    const balances: Record<string, { paid: number, cost: number, net: number, name: string }> = {}

    golfers.forEach(g => {
      balances[g.id] = { paid: 0, cost: 0, net: 0, name: g.name }
    })

    expenses.forEach(exp => {
      const amt = exp.amount
      
      if (balances[exp.payer_id]) {
        balances[exp.payer_id].paid += amt
      }

      const consumers = (exp.split_among && exp.split_among.length > 0) 
        ? exp.split_among 
        : golfers.map(g => g.id)

      const costPerPerson = amt / consumers.length

      consumers.forEach(consumerId => {
        if (balances[consumerId]) {
          balances[consumerId].cost += costPerPerson
        }
      })
    })

    Object.keys(balances).forEach(id => {
      balances[id].net = balances[id].paid - balances[id].cost
    })

    return Object.values(balances).sort((a, b) => b.net - a.net)
  }

  const balanceData = calculateBalances()
  const totalTripCost = expenses.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div style={containerStyle}>
      {/* Header & Tabs */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
        <h3 style={headerStyle}>💰 Money</h3>
        <div style={tabContainer}>
          <button 
            style={activeTab === 'ledger' ? activeTabStyle : tabStyle} 
            onClick={() => setActiveTab('ledger')}
          >
            Ledger
          </button>
          <button 
            style={activeTab === 'balances' ? activeTabStyle : tabStyle} 
            onClick={() => setActiveTab('balances')}
          >
            Balances
          </button>
        </div>
      </div>

      {/* --- TAB 1: LEDGER --- */}
      {activeTab === 'ledger' && (
        <>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
             <div style={totalBadge}>Trip Total: ${totalTripCost.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
             {!isFormOpen && (
               <button onClick={() => setIsFormOpen(true)} style={actionButton}>+ Add Expense</button>
             )}
          </div>

          {isFormOpen && (
            <form onSubmit={handleAddExpense} style={formStyle}>
              <h4 style={{marginTop: 0, color: '#059669', marginBottom: '10px'}}>Add New Expense</h4>
              
              <div style={{display: 'flex', gap: '10px', marginBottom: '10px'}}>
                <div style={{flex: 1}}>
                  <label style={labelStyle}>Who Paid?</label>
                  <select style={inputStyle} value={payerId} onChange={e => setPayerId(e.target.value)} required>
                    <option value="">Select Payer...</option>
                    {golfers.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div style={{flex: 1}}>
                  <label style={labelStyle}>Amount ($)</label>
                  <input type="number" step="0.01" style={inputStyle} value={amount} onChange={e => setAmount(e.target.value)} required />
                </div>
              </div>

              <div style={{marginBottom: '10px'}}>
                <label style={labelStyle}>Description</label>
                <input style={inputStyle} value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Costco Run" required />
              </div>

              <div style={{marginBottom: '15px'}}>
                <label style={labelStyle}>Split Among (Leave empty for Everyone)</label>
                <div style={{display: 'flex', flexWrap: 'wrap', gap: '5px'}}>
                  {golfers.map(g => {
                    const isSelected = splitWith.includes(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) setSplitWith(splitWith.filter(id => id !== g.id))
                          else setSplitWith([...splitWith, g.id])
                        }}
                        style={isSelected ? pillSelected : pillNormal}
                      >
                        {g.name}
                      </button>
                    )
                  })}
                </div>
                <div style={{fontSize: '0.75rem', color: '#6b7280', marginTop: '4px'}}>
                  {splitWith.length === 0 ? 'Splitting equally among everyone.' : `Splitting among ${splitWith.length} people.`}
                </div>
              </div>

              <div style={{display: 'flex', gap: '10px'}}>
                <button type="submit" disabled={loading} style={saveBtnStyle}>Save Expense</button>
                <button type="button" onClick={resetForm} style={cancelBtnStyle}>Cancel</button>
              </div>
            </form>
          )}

          {expenses.length === 0 ? (
            <div style={emptyStateContainer}>
               <p style={emptyStateText}>No expenses yet. Add costs here to split them later.</p>
            </div>
          ) : (
            <div style={{display: 'flex', flexDirection: 'column'}}>
              {expenses.map(exp => (
                <div key={exp.id} style={itemRow}>
                  <div style={{flex: 1}}>
                    <div style={{fontWeight: '600', color: '#111827'}}>{exp.description}</div>
                    <div style={{fontSize: '0.85rem', color: '#6b7280'}}>
                      <span style={{fontWeight: '500', color: '#4b5563'}}>{exp.trip_golfers?.name}</span> paid
                      {exp.split_among ? ` for ${exp.split_among.length} people` : ` for everyone`}
                    </div>
                  </div>
                  <div style={{fontWeight: 'bold', color: '#059669', fontSize: '1.1rem', marginRight: '15px'}}>
                    ${exp.amount.toFixed(2)}
                  </div>
                  <button onClick={() => handleDelete(exp.id)} style={deleteBtn}>×</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* --- TAB 2: BALANCES --- */}
      {activeTab === 'balances' && (
        <div>
          <div style={{marginBottom: '15px', fontSize: '0.9rem', color: '#4b5563', lineHeight: '1.4'}}>
            <strong>How to read this:</strong> <br/>
            <span style={{color: '#059669', fontWeight: 'bold'}}>Green</span> means you are owed money (you paid more than your share). <br/>
            <span style={{color: '#dc2626', fontWeight: 'bold'}}>Red</span> means you owe money (you haven't paid enough yet).
          </div>
          
          <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
            {balanceData.map(b => (
              <div key={b.name} style={balanceCard}>
                <div style={{fontWeight: 'bold', fontSize: '1rem', color: '#111827'}}>{b.name}</div>
                <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                   <div style={{fontSize: '0.8rem', color: '#6b7280'}}>
                     Paid: ${b.paid.toFixed(0)} | Share: ${b.cost.toFixed(0)}
                   </div>
                   <div style={{
                     fontWeight: 'bold', 
                     color: b.net >= 0 ? '#059669' : '#dc2626',
                     backgroundColor: b.net >= 0 ? '#ecfdf5' : '#fef2f2',
                     padding: '2px 8px', borderRadius: '4px'
                   }}>
                     {b.net >= 0 ? '+' : ''}${b.net.toFixed(2)}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Styles
const containerStyle: React.CSSProperties = { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '20px', border: '1px solid #e5e7eb' }
const headerStyle: React.CSSProperties = { margin: 0, color: '#111827', fontSize: '1.1rem' }
const tabContainer: React.CSSProperties = { display: 'flex', gap: '5px', backgroundColor: '#f3f4f6', padding: '3px', borderRadius: '8px' }
const tabStyle: React.CSSProperties = { border: 'none', backgroundColor: 'transparent', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', color: '#6b7280' }
const activeTabStyle: React.CSSProperties = { ...tabStyle, backgroundColor: 'white', color: '#111827', fontWeight: 'bold', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }
const totalBadge: React.CSSProperties = { backgroundColor: '#ecfdf5', color: '#065f46', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid #a7f3d0' }
const actionButton: React.CSSProperties = { padding: '6px 12px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }
const formStyle: React.CSSProperties = { backgroundColor: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '20px' }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', color: '#374151', marginBottom: '4px', fontWeight: 'bold' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.9rem', boxSizing: 'border-box' }
const saveBtnStyle: React.CSSProperties = { padding: '8px 16px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }
const cancelBtnStyle: React.CSSProperties = { padding: '8px 16px', backgroundColor: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer' }
const itemRow: React.CSSProperties = { display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f3f4f6' }
const deleteBtn: React.CSSProperties = { backgroundColor: 'transparent', border: 'none', color: '#ef4444', fontSize: '1.2rem', cursor: 'pointer', fontWeight: 'bold' }
const pillNormal: React.CSSProperties = { padding: '4px 8px', borderRadius: '12px', border: '1px solid #d1d5db', backgroundColor: 'white', fontSize: '0.8rem', cursor: 'pointer', color: '#374151' }
const pillSelected: React.CSSProperties = { padding: '4px 8px', borderRadius: '12px', border: '1px solid #059669', backgroundColor: '#ecfdf5', fontSize: '0.8rem', cursor: 'pointer', color: '#065f46', fontWeight: 'bold' }
const balanceCard: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb' }
const emptyStateContainer: React.CSSProperties = { padding: '20px 0', textAlign: 'center' }
const emptyStateText: React.CSSProperties = { color: '#9ca3af', fontStyle: 'italic', fontSize: '0.9rem', margin: 0 }
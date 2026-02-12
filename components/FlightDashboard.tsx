'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { formatTime } from '@/utils/format'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface FlightLeg {
  id: string
  golfer_name: string
  airline: string
  flight_number: string
  airport: string
  time: string
}

interface Props {
  tripId: string
}

export default function FlightDashboard({ tripId }: Props) {
  const [arrivals, setArrivals] = useState<FlightLeg[]>([])
  const [departures, setDepartures] = useState<FlightLeg[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFlights()
  }, [tripId])

  const fetchFlights = async () => {
    // Fetch golfers and their flights
    const { data: golfers } = await supabase
      .from('trip_golfers')
      .select(`
        name,
        flights:golfer_flights(*)
      `)
      .eq('trip_id', tripId)

    if (golfers) {
      const arr: FlightLeg[] = []
      const dep: FlightLeg[] = []

      golfers.forEach((golfer: any) => {
        golfer.flights.forEach((f: any) => {
          if (!f.arrival_time && !f.departure_time) return

          const leg = {
            id: f.id,
            golfer_name: golfer.name,
            airline: f.airline,
            flight_number: f.flight_number,
            airport: f.leg_type === 'arrival' ? f.arrival_airport : f.departure_airport,
            time: f.leg_type === 'arrival' ? f.arrival_time : f.departure_time
          }

          if (f.leg_type === 'arrival' && leg.time) {
            arr.push(leg)
          } else if (f.leg_type === 'departure' && leg.time) {
            dep.push(leg)
          }
        })
      })

      // Sort by Time (Earliest First)
      arr.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
      dep.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())

      setArrivals(arr)
      setDepartures(dep)
    }
    setLoading(false)
  }

  if (loading) return <div style={containerStyle}>Loading flights...</div>
  if (arrivals.length === 0 && departures.length === 0) return null // Don't show if no data

  return (
    <div style={containerStyle}>
      <h3 style={headerStyle}>✈️ Airport Logistics</h3>
      
      <div style={gridStyle}>
        {/* ARRIVALS COLUMN */}
        <div style={columnStyle}>
          <div style={subHeaderStyle}>
            <span style={{marginRight: '8px'}}>🛬</span> 
            Incoming (Pickups)
          </div>
          {arrivals.length === 0 ? (
            <p style={emptyText}>No arrival flights tracked.</p>
          ) : (
            <div style={listStyle}>
              {arrivals.map(f => (
                <div key={f.id} style={cardStyle}>
                  <div style={timeBadge}>{formatTime(f.time)}</div>
                  <div style={{flex: 1}}>
                    <div style={nameStyle}>{f.golfer_name}</div>
                    <div style={detailStyle}>
                      {f.airline} {f.flight_number} → {f.airport}
                    </div>
                    <div style={dateStyle}>
                      {new Date(f.time).toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DEPARTURES COLUMN */}
        <div style={columnStyle}>
          <div style={subHeaderStyle}>
            <span style={{marginRight: '8px'}}>🛫</span> 
            Outgoing (Drop-offs)
          </div>
          {departures.length === 0 ? (
            <p style={emptyText}>No departure flights tracked.</p>
          ) : (
            <div style={listStyle}>
              {departures.map(f => (
                <div key={f.id} style={cardStyle}>
                  <div style={{...timeBadge, backgroundColor: '#fff7ed', color: '#c2410c', border: '1px solid #ffedd5'}}>
                    {formatTime(f.time)}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={nameStyle}>{f.golfer_name}</div>
                    <div style={detailStyle}>
                      {f.airport} → {f.airline} {f.flight_number}
                    </div>
                    <div style={dateStyle}>
                      {new Date(f.time).toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'})}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Styles
const containerStyle: React.CSSProperties = { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '20px', border: '1px solid #e5e7eb' }
const headerStyle: React.CSSProperties = { marginTop: 0, marginBottom: '20px', color: '#111827', fontSize: '1.2rem' }
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }
const columnStyle: React.CSSProperties = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '15px', border: '1px solid #e5e7eb' }
const subHeaderStyle: React.CSSProperties = { fontWeight: 'bold', color: '#374151', marginBottom: '15px', display: 'flex', alignItems: 'center', fontSize: '1rem' }
const listStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '10px' }
const cardStyle: React.CSSProperties = { backgroundColor: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }
const timeBadge: React.CSSProperties = { backgroundColor: '#ecfdf5', color: '#047857', padding: '6px 10px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid #d1fae5', minWidth: '70px', textAlign: 'center' }
const nameStyle: React.CSSProperties = { fontWeight: 'bold', color: '#111827', fontSize: '0.95rem' }
const detailStyle: React.CSSProperties = { fontSize: '0.85rem', color: '#4b5563', marginTop: '2px' }
const dateStyle: React.CSSProperties = { fontSize: '0.75rem', color: '#9ca3af', marginTop: '2px' }
const emptyText: React.CSSProperties = { fontStyle: 'italic', color: '#9ca3af', fontSize: '0.9rem' }
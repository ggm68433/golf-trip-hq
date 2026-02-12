'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { formatTime } from '@/utils/format'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface RoundWeather {
  round_id: string
  course_name: string
  date: string
  tee_time: string
  temp: number | null
  description: string
  icon: string
  pop: number
  wind_speed: number
  is_too_far: boolean
}

interface Props {
  tripId: string
}

export default function WeatherWidget({ tripId }: Props) {
  const [forecasts, setForecasts] = useState<RoundWeather[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRoundWeather()
  }, [tripId])

  const fetchRoundWeather = async () => {
    const apiKey = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY
    if (!apiKey) return setLoading(false)

    // 1. Get Rounds + Course Location
    const { data: rounds } = await supabase
      .from('rounds')
      .select(`
        id, round_date, tee_time,
        course:courses (name, city, zip_code)
      `)
      .eq('trip_id', tripId)
      .order('round_date', { ascending: true })
      .order('tee_time', { ascending: true })

    if (!rounds || rounds.length === 0) {
      setLoading(false)
      return
    }

    const weatherPromises = rounds.map(async (round: any) => {
      const course = round.course
      const roundDate = round.round_date
      
      const result: RoundWeather = {
        round_id: round.id,
        course_name: course?.name || 'Unknown Course',
        date: roundDate,
        tee_time: round.tee_time,
        temp: null,
        description: '',
        icon: '',
        pop: 0,
        wind_speed: 0,
        is_too_far: false
      }

      if (!course || (!course.city && !course.zip_code)) return result

      const query = course.zip_code ? `${course.zip_code},us` : course.city
      
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=${query}&units=imperial&appid=${apiKey}`
        )
        const data = await res.json()

        if (data.cod !== '200') return result

        // Find match closest to Tee Time
        const targetDateTime = new Date(`${roundDate}T${round.tee_time || '12:00:00'}`).getTime()
        
        let closestBlock: any = null
        let minDiff = Infinity

        data.list.forEach((item: any) => {
          const itemTime = new Date(item.dt * 1000).getTime()
          const diff = Math.abs(targetDateTime - itemTime)
          const itemDateString = item.dt_txt.split(' ')[0]
          
          if (itemDateString === roundDate) {
             if (diff < minDiff) {
               minDiff = diff
               closestBlock = item
             }
          }
        })

        if (closestBlock) {
          result.temp = Math.round(closestBlock.main.temp)
          result.description = closestBlock.weather[0].main
          result.icon = closestBlock.weather[0].icon
          result.pop = closestBlock.pop
          result.wind_speed = Math.round(closestBlock.wind.speed)
        } else {
          const today = new Date().toISOString().split('T')[0]
          if (roundDate > today) result.is_too_far = true
        }

      } catch (err) {
        console.error('Weather fetch error', err)
      }

      return result
    })

    const results = await Promise.all(weatherPromises)
    setForecasts(results)
    setLoading(false)
  }

  // Helper to render date LOCALLY (avoids UTC shift to previous day)
  const renderDate = (dateStr: string) => {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString(undefined, {weekday: 'short'})
  }

  if (loading) return <div style={containerStyle}>Checking forecast...</div>
  if (forecasts.length === 0) return null

  return (
    <div style={containerStyle}>
      <h3 style={headerStyle}>⛳️ Round Forecast</h3>
      <div style={gridStyle}>
        {forecasts.map((item) => (
          <div key={item.round_id} style={cardStyle}>
            <div style={courseHeader}>{item.course_name}</div>
            <div style={subHeader}>
              {renderDate(item.date)} • {formatTime(item.tee_time)}
            </div>

            {item.temp !== null ? (
              <div style={weatherRow}>
                <img 
                  src={`https://openweathermap.org/img/wn/${item.icon}.png`} 
                  alt={item.description}
                  style={{width: '40px', height: '40px'}} 
                />
                <div style={tempStyle}>{item.temp}°</div>
                <div style={statsCol}>
                  {item.pop > 0.2 && <div style={{color: '#2563eb', fontSize: '0.75rem'}}>💧 {Math.round(item.pop * 100)}%</div>}
                  {item.wind_speed > 10 && <div style={{color: '#d97706', fontSize: '0.75rem'}}>💨 {item.wind_speed} mph</div>}
                </div>
              </div>
            ) : (
              <div style={emptyState}>
                {item.is_too_far ? 'Forecast not yet available' : 'No Data'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Styles
const containerStyle: React.CSSProperties = { backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '20px', border: '1px solid #e5e7eb' }
const headerStyle: React.CSSProperties = { marginTop: 0, marginBottom: '15px', color: '#111827', fontSize: '1.1rem' }
const gridStyle: React.CSSProperties = { display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }
const cardStyle: React.CSSProperties = { 
  minWidth: '180px', padding: '12px', borderRadius: '8px', 
  border: '1px solid #e5e7eb', backgroundColor: '#f9fafb',
  display: 'flex', flexDirection: 'column', justifyContent: 'center'
}
const courseHeader: React.CSSProperties = { fontWeight: 'bold', fontSize: '0.9rem', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }
const subHeader: React.CSSProperties = { fontSize: '0.8rem', color: '#6b7280', marginBottom: '8px' }
const weatherRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' }
const tempStyle: React.CSSProperties = { fontSize: '1.4rem', fontWeight: 'bold', color: '#111827' }
const statsCol: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '2px' }
const emptyState: React.CSSProperties = { fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic', marginTop: '10px' }
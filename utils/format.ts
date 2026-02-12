export const formatTime = (timeStr: string | null) => {
  if (!timeStr) return ''
  
  // Handle Postgres Time (e.g., "14:30:00")
  if (timeStr.includes(':') && !timeStr.includes('T')) {
    const [hours, minutes] = timeStr.split(':')
    const date = new Date()
    date.setHours(parseInt(hours), parseInt(minutes))
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  // Handle ISO Timestamp
  const date = new Date(timeStr)
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export const formatTripDates = (start: string, end: string) => {
  if (!start || !end) return ''
  
  // Helper to parse "YYYY-MM-DD" as LOCAL time
  const parseLocal = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  const s = parseLocal(start)
  const e = parseLocal(end)

  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }

  // 1. Same Year? (e.g. "Feb 27 – Mar 9, 2026")
  if (s.getFullYear() === e.getFullYear()) {
    return `${s.toLocaleDateString('en-US', options)} – ${e.toLocaleDateString('en-US', options)}, ${s.getFullYear()}`
  }

  // 2. Different Years? (e.g. "Dec 28, 2025 – Jan 4, 2026")
  return `${s.toLocaleDateString('en-US', { ...options, year: 'numeric' })} – ${e.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`
}

// NEW: Friendly Single Date (e.g. "Fri, Feb 27")
export const formatSingleDate = (dateStr: string) => {
  if (!dateStr) return ''
  // Use .split('T')[0] to ensure we only grab the date part YYYY-MM-DD
  const [y, m, d] = dateStr.split('T')[0].split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
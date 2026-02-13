export interface Trip {
  id: string
  owner_id: string
  trip_name: string
  start_date: string
  end_date: string
  location?: string
}

export interface Golfer {
  id: string
  trip_id: string
  user_id?: string | null
  name: string
  email?: string | null
  handicap: number
  profile_name?: string
  is_driving?: boolean
  flights?: Flight[]
  status?: 'accepted' | 'invited' | 'declined' // <--- ADD THIS
}

export interface Flight {
  id: string
  golfer_id: string
  trip_id: string
  leg_type: 'arrival' | 'departure'
  airline: string
  flight_number: string
  departure_airport: string
  arrival_airport: string
  departure_time: string
  arrival_time: string
}

export interface Lodging {
  id: string
  trip_id: string
  name: string
  street_address: string
  city?: string
  state?: string
  zip_code?: string
  website_url?: string
  check_in_time: string
  check_out_time: string
}

export interface Dining {
  id: string
  trip_id: string
  name: string
  street_address: string
  city?: string
  state?: string
  zip_code?: string
  website_url?: string
  reservation_time: string
  party_size: number
}

export interface Expense {
  id: string
  trip_id: string
  payer_id: string
  description: string  // Changed from title
  amount: number
  expense_date: string
  split_method: string
  split_among?: string[] // Added array
  created_at?: string
}
// ... rest of the types stay the same

export interface Course {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
  zip_code?: string
}

export interface Round {
  id: string
  trip_id: string
  course_id: string
  round_date: string
  tee_time: string
  courses?: Course
  round_players?: {
    trip_golfers: {
      id: string
      name: string
      handicap: number
    }
  }[]
}

export interface RoundWeather {
  temp: number | null
  description: string
  icon: string
  wind_speed: number | null
  pop: number | null // Probability of Precipitation
}
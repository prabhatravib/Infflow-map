export interface TripStop {
  name: string
  lat: number
  lng: number
  description?: string
  address?: string
  placeType?: string
}

export interface TripDay {
  label?: string
  stops: TripStop[]
}

export interface TripMetadata {
  city?: string
  days?: number
  center?: {
    lat: number
    lng: number
  }
}

export interface TripData {
  days: TripDay[]
  metadata?: TripMetadata
  tips?: string[]
}


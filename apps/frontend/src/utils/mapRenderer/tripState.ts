import { TripData } from '../tripTypes'

let pendingTrip: TripData | null = null

export function setPendingTrip(trip: TripData | null) {
  pendingTrip = trip
}

export function getPendingTrip() {
  return pendingTrip
}


export interface LatLngLiteral {
  lat: number
  lng: number
}

export function toLatLngLiteral(input: any): LatLngLiteral | null {
  if (!input) return null
  if (typeof input.lat === 'function' && typeof input.lng === 'function') {
    const lat = input.lat()
    const lng = input.lng()
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
    return null
  }

  if (typeof input.lat === 'number' && typeof input.lng === 'number') {
    return { lat: input.lat, lng: input.lng }
  }

  if ('latLng' in input && typeof input.latLng?.lat === 'function' && typeof input.latLng?.lng === 'function') {
    const lat = input.latLng.lat()
    const lng = input.latLng.lng()
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng }
    }
  }

  return null
}

const BASE_COLOURS = ['#2196f3', '#f44336', '#4caf50', '#ff9800', '#9c27b0', '#009688', '#3f51b5']

export function getColourForDay(dayIndex: number): string {
  return BASE_COLOURS[dayIndex % BASE_COLOURS.length]
}

export function estimateDrivingTime(start: LatLngLiteral, end: LatLngLiteral): string {
  const R = 6371
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(end.lat - start.lat)
  const dLon = toRad(end.lng - start.lng)
  const lat1 = toRad(start.lat)
  const lat2 = toRad(end.lat)

  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const distanceKm = R * c

  const minutes = Math.round((distanceKm / 40) * 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder > 0 ? `${hours} hr ${remainder} min` : `${hours} hr`
}


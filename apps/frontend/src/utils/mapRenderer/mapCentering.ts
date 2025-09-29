import { CITY_CENTER_CACHE, getMap, getGoogleMaps, getOrCreateGeocoder } from './state'

export function centerMapOnCity(city: string) {
  const map = getMap()
  const gmaps = getGoogleMaps()
  if (!map || !gmaps || !city) return

  const normalizedCity = city.trim()
  if (!normalizedCity) return

  const cacheKey = normalizedCity.toLowerCase()
  const cached = CITY_CENTER_CACHE.get(cacheKey)
  if (cached) {
    map.setCenter(cached)
    map.setZoom(12)
    return
  }

  const geocoder = getOrCreateGeocoder()
  if (!geocoder) return

  geocoder.geocode({ address: normalizedCity }, (results: any, status: string) => {
    if (status === 'OK' && Array.isArray(results) && results[0]?.geometry?.location) {
      const location = results[0].geometry.location
      const target = { lat: location.lat(), lng: location.lng() }
      CITY_CENTER_CACHE.set(cacheKey, target)
      map.setCenter(target)
      map.setZoom(12)
    }
  })
}

export function centerMapOnCoordinates(center: { lat: number; lng: number }) {
  const map = getMap()
  if (!map) return

  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return

  map.setCenter(center)
  map.setZoom(12)
  const cacheKey = `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`
  CITY_CENTER_CACHE.set(cacheKey, center)
}


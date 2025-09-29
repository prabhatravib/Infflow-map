const GEOCODE_CACHE = new Map<string, { lat: number; lng: number }>()

export function ensureNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export async function geocodePlace(query: string, city: string | undefined, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  if (!apiKey || !query) return null

  const cacheKey = `${(query + (city ? `,${city}` : '')).toLowerCase()}|${apiKey}`
  const cached = GEOCODE_CACHE.get(cacheKey)
  if (cached) {
    return cached
  }

  const placeResult = await callFindPlace(query, city, apiKey)
  if (placeResult) {
    GEOCODE_CACHE.set(cacheKey, placeResult)
    return placeResult
  }

  const geocodeResult = await callGeocode(query, city, apiKey)
  if (geocodeResult) {
    GEOCODE_CACHE.set(cacheKey, geocodeResult)
    return geocodeResult
  }

  if (city && !query.toLowerCase().includes(city.toLowerCase())) {
    return geocodePlace(`${query}, ${city}`, undefined, apiKey)
  }

  return null
}

async function callFindPlace(query: string, city: string | undefined, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    input: city ? `${query}, ${city}` : query,
    inputtype: 'textquery',
    fields: 'geometry/location,place_id',
    key: apiKey,
  })

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params.toString()}`)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const candidate = data?.candidates?.[0]
    const location = candidate?.geometry?.location
    if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
      return { lat: location.lat, lng: location.lng }
    }

    if (candidate?.place_id) {
      const placeDetails = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${candidate.place_id}&fields=geometry/location&key=${apiKey}`
      )
      if (placeDetails.ok) {
        const detailsData = await placeDetails.json()
        const detailsLocation = detailsData?.result?.geometry?.location
        if (detailsLocation && Number.isFinite(detailsLocation.lat) && Number.isFinite(detailsLocation.lng)) {
          return { lat: detailsLocation.lat, lng: detailsLocation.lng }
        }
      }
    }
  } catch (error) {
    console.warn('Find Place request failed', error)
  }

  return null
}

async function callGeocode(query: string, city: string | undefined, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({
    address: city ? `${query}, ${city}` : query,
    key: apiKey,
  })

  if (city) {
    params.set('components', `locality:${city}`)
  }

  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`)
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    const location = data?.results?.[0]?.geometry?.location
    if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) {
      return { lat: location.lat, lng: location.lng }
    }
  } catch (error) {
    console.warn('Geocode request failed', error)
  }

  return null
}

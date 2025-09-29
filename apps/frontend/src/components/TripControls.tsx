import { KeyboardEvent, useState } from 'react'
import { ApiConfig } from '../utils/apiConfig'
import { renderTripOnMap } from '../utils/mapRenderer'
import { TripData, TripDay, TripStop } from '../utils/tripTypes'
import styles from './TripControls.module.css'

const DEFAULT_CITY = 'Paris'
const DEFAULT_DAYS = 3
const MIN_DAYS = 1
const MAX_DAYS = 14

export function TripControls() {
  const [city, setCity] = useState(DEFAULT_CITY)
  const [days, setDays] = useState(DEFAULT_DAYS)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleLaunchTrip = async () => {
    const normalizedCity = city.trim()
    const normalizedDays = clampDays(days)

    if (!normalizedCity || normalizedDays < MIN_DAYS) {
      setError('Please enter a valid city and number of days')
      return
    }

    setIsProcessing(true)
    setError(null)
    setFeedback(null)

    try {
      const data = await ApiConfig.fetchJson<ApiItineraryResponse>('/api/itinerary', {
        method: 'POST',
        body: JSON.stringify({
          city: normalizedCity,
          days: normalizedDays,
        }),
      })

      const trip = transformResponseToTripData(data)

      sessionStorage.setItem('currentItinerary', JSON.stringify(trip))
      sessionStorage.setItem('currentCity', normalizedCity)
      sessionStorage.setItem('currentDays', String(trip.metadata?.days ?? normalizedDays))

      setCity(normalizedCity)
      const resolvedDays = trip.metadata?.days ?? normalizedDays
      setDays(resolvedDays)
      if ((window as any).travelMap) {
        renderTripOnMap(trip)
      }

      setFeedback(`Itinerary ready for ${normalizedCity}`)
    } catch (fetchError) {
      console.error('[TripControls] Failed to create itinerary', fetchError)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to create itinerary')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCityKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (isProcessing || !city.trim()) return
    void handleLaunchTrip()
  }

  const handleDaysChange = (value: string) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue)) {
      setDays(MIN_DAYS)
      return
    }

    const clamped = clampDays(numericValue)
    setDays(clamped)
  }

  const toggleCollapsed = () => {
    setIsCollapsed((previous) => !previous)
  }

  const toggleLabel = isCollapsed ? 'Maximize trip planner' : 'Minimize trip planner'

  return (
    <section
      className={`${styles.tripControls}${isCollapsed ? ` ${styles.tripControlsCollapsed}` : ''}`}
      aria-label="Trip planner controls"
    >
      <div className={styles.body}>
        <header className={styles.header}>
          <h2 className={styles.title}>Trip Planner</h2>
          <button
            type="button"
            className={styles.toggle}
            onClick={toggleCollapsed}
            aria-label={toggleLabel}
            aria-expanded={!isCollapsed}
            title={toggleLabel}
          >
            <span aria-hidden="true">{isCollapsed ? '+' : '-'}</span>
          </button>
        </header>

        {!isCollapsed && (
          <>
            <div className={styles.inputs}>
              <input
                className={`${styles.input} ${styles.inputCity}`}
                type="text"
                placeholder="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                onKeyDown={handleCityKeyDown}
                disabled={isProcessing}
                aria-label="City"
              />
              <input
                className={`${styles.input} ${styles.inputDays}`}
                type="number"
                min={MIN_DAYS}
                max={MAX_DAYS}
                value={days}
                onChange={(event) => handleDaysChange(event.target.value)}
                disabled={isProcessing}
                aria-label="Number of days"
              />
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                className={styles.launchButton}
                onClick={handleLaunchTrip}
                disabled={isProcessing || !city.trim()}
              >
                {isProcessing ? 'Planning...' : 'Launch Trip'}
              </button>
              <p
                className={`${styles.feedback}${error ? ` ${styles.feedbackError}` : ''}`}
                role="status"
              >
                {error ?? feedback}
              </p>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

function clampDays(value: number): number {
  if (!Number.isFinite(value)) return MIN_DAYS
  return Math.min(Math.max(Math.round(value), MIN_DAYS), MAX_DAYS)
}

interface ApiItineraryResponse {
  city?: string
  days?: number | ApiDay[]
  itinerary?: unknown
  locations?: ApiLocation[]
  tips?: string[]
  metadata?: {
    city?: string
    days?: number
    center?: {
      lat?: number
      lng?: number
    }
  }
}

interface ApiDay {
  day?: number
  label?: string
  stops?: ApiLocation[]
}

interface ApiLocation {
  name: string
  lat?: number
  lng?: number
  day?: number
  description?: string
  address?: string
  placeType?: string
}

function transformResponseToTripData(data: ApiItineraryResponse): TripData {
  const daysFromApi = Array.isArray(data.days) ? data.days : null
  const locations = Array.isArray(data.locations) ? data.locations : []
  let centerPoint: { lat: number; lng: number } | undefined

  const buildStop = (location: ApiLocation | undefined): TripStop | null => {
    if (!location) return null

    const lat = typeof location.lat === 'number' ? location.lat : Number(location.lat)
    const lng = typeof location.lng === 'number' ? location.lng : Number(location.lng)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null
    }

    return {
      name: location.name,
      lat,
      lng,
      description: location.description,
      address: location.address,
      placeType: location.placeType,
    }
  }

  const tripDays: TripDay[] = []

  if (daysFromApi) {
    daysFromApi.forEach((dayEntry, index) => {
      const stops = (dayEntry.stops ?? [])
        .map(buildStop)
        .filter((stop): stop is TripStop => Boolean(stop))

      if (!centerPoint && stops[0]) {
        centerPoint = { lat: stops[0].lat, lng: stops[0].lng }
      }

      tripDays.push({
        label: dayEntry.label || `Day ${dayEntry.day ?? index + 1}`,
        stops,
      })
    })
  }

  if (tripDays.length === 0 && locations.length > 0) {
    const dayBuckets = new Map<number, TripStop[]>()
    let maxDay = 0

    locations.forEach((location) => {
      const stop = buildStop(location)
      if (!stop) return

      const zeroBasedDay = Math.max((location.day ?? 1) - 1, 0)
      maxDay = Math.max(maxDay, zeroBasedDay)

      if (!dayBuckets.has(zeroBasedDay)) {
        dayBuckets.set(zeroBasedDay, [])
      }

      dayBuckets.get(zeroBasedDay)!.push(stop)

      if (!centerPoint) {
        centerPoint = { lat: stop.lat, lng: stop.lng }
      }
    })

    for (let index = 0; index <= maxDay; index += 1) {
      tripDays.push({
        label: `Day ${index + 1}`,
        stops: dayBuckets.get(index) ?? [],
      })
    }
  }

  const resolvedDaysCount = tripDays.length > 0 ? tripDays.length : Math.max((typeof data.days === 'number' ? data.days : data.metadata?.days) ?? 0, 1)

  if (tripDays.length === 0) {
    for (let index = 0; index < resolvedDaysCount; index += 1) {
      tripDays.push({ label: `Day ${index + 1}`, stops: [] })
    }
  }

  if (!centerPoint) {
    const metaCenter = data.metadata?.center
    const lat = typeof metaCenter?.lat === 'number' ? metaCenter.lat : Number(metaCenter?.lat)
    const lng = typeof metaCenter?.lng === 'number' ? metaCenter.lng : Number(metaCenter?.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      centerPoint = { lat, lng }
    }
  }

  return {
    days: tripDays,
    metadata: {
      city: data.metadata?.city ?? data.city,
      days: resolvedDaysCount,
      center: centerPoint,
    },
    tips: Array.isArray(data.tips) ? data.tips : undefined,
  }
}


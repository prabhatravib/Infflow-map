import { useEffect, useMemo, useState } from 'react'
import { ApiConfig } from '../utils/apiConfig'

interface ItineraryResponse {
  city: string
  days: number
  itinerary: unknown[]
  locations: Array<{
    lat: number
    lng: number
    name: string
    day: number
    description?: string
    address?: string
  }>
  tips: string[]
}

const DEFAULT_CITY = 'Paris'
const DEFAULT_DAYS = 3
const MIN_DAYS = 1
const MAX_DAYS = 14

export function TripControls() {
  const [city, setCity] = useState(DEFAULT_CITY)
  const [days, setDays] = useState(DEFAULT_DAYS)
  const [itineraryDays, setItineraryDays] = useState(0)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [hasItinerary, setHasItinerary] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const dayButtons = useMemo(() => createDayRange(itineraryDays), [itineraryDays])

  useEffect(() => {
    if (!hasItinerary) return
    updateMapVisibility(selectedDays)
  }, [selectedDays, hasItinerary])

  const handleDayToggle = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((value) => value !== day)
      }
      return [...prev, day].sort((a, b) => a - b)
    })
  }

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
      const data = await ApiConfig.fetchJson<ItineraryResponse>('/api/itinerary', {
        method: 'POST',
        body: JSON.stringify({
          city: normalizedCity,
          days: normalizedDays,
        }),
      })

      sessionStorage.setItem('currentItinerary', JSON.stringify(data))
      sessionStorage.setItem('currentCity', normalizedCity)
      sessionStorage.setItem('currentDays', String(data.days ?? normalizedDays))

      setCity(normalizedCity)
      setDays(data.days ?? normalizedDays)
      const totalDays = data.days ?? normalizedDays
      setItineraryDays(totalDays)
      const allDays = createDayRange(totalDays)
      setSelectedDays(allDays)
      setHasItinerary(true)

      if ((window as any).travelMap && Array.isArray(data.locations)) {
        updateMapWithItinerary(data.locations)
      }

      setFeedback(`Itinerary ready for ${normalizedCity}`)
    } catch (fetchError) {
      console.error('[TripControls] Failed to create itinerary', fetchError)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to create itinerary')
    } finally {
      setIsProcessing(false)
    }
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

  return (
    <section className="trip-controls" aria-label="Trip planner controls">
      <div className="trip-controls__body">
        <header className="trip-controls__header">
          <h2 className="trip-controls__title">Trip Planner</h2>
        </header>

        <div className="trip-controls__inputs">
          <input
            className="trip-controls__input trip-controls__input--city"
            type="text"
            placeholder="City"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            disabled={isProcessing}
            aria-label="City"
          />
          <input
            className="trip-controls__input trip-controls__input--days"
            type="number"
            min={MIN_DAYS}
            max={MAX_DAYS}
            value={days}
            onChange={(event) => handleDaysChange(event.target.value)}
            disabled={isProcessing}
            aria-label="Number of days"
          />
        </div>

        <div className="trip-controls__actions">
          <button
            type="button"
            className="trip-controls__launch"
            onClick={handleLaunchTrip}
            disabled={isProcessing || !city.trim()}
          >
            {isProcessing ? 'Planning...' : 'Launch Trip'}
          </button>
          <p className={`trip-controls__feedback${error ? ' trip-controls__error' : ''}`} role="status">
            {error ?? feedback}
          </p>
        </div>

        {hasItinerary && dayButtons.length > 0 && (
          <div className="trip-controls__day-toggle" role="group" aria-label="Toggle itinerary days">
            {dayButtons.map((day) => (
              <button
                key={day}
                type="button"
                className={`trip-controls__day-button${selectedDays.includes(day) ? ' trip-controls__day-button--active' : ''}`}
                onClick={() => handleDayToggle(day)}
                aria-pressed={selectedDays.includes(day)}
              >
                Day {day}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function createDayRange(totalDays: number): number[] {
  return Array.from({ length: Math.max(totalDays, 0) }, (_, index) => index + 1)
}

function clampDays(value: number): number {
  if (!Number.isFinite(value)) return MIN_DAYS
  return Math.min(Math.max(Math.round(value), MIN_DAYS), MAX_DAYS)
}

function updateMapWithItinerary(locations: ItineraryResponse['locations']) {
  const map = (window as any).travelMap
  const googleMaps = (window as any).google?.maps
  if (!map || !Array.isArray(locations) || !googleMaps) return

  if (Array.isArray((window as any).markers)) {
    ;(window as any).markers.forEach((marker: any) => {
      if (marker?.setMap) {
        marker.setMap(null)
      }
    })
  }

  const markers: any[] = []
  const bounds = new googleMaps.LatLngBounds()

  locations.forEach((location, index) => {
    const marker = new googleMaps.Marker({
      position: { lat: location.lat, lng: location.lng },
      map,
      title: location.name,
      label: String(index + 1),
    })

    const infoWindow = new googleMaps.InfoWindow({
      content: `
        <div class="info-window">
          <h4>${location.name}</h4>
          <p><strong>Day ${location.day}</strong></p>
          <p>${location.description ?? ''}</p>
          ${location.address ? `<p><small>${location.address}</small></p>` : ''}
        </div>
      `,
    })

    marker.addListener('click', () => {
      infoWindow.open(map, marker)
    })

    markers.push(marker)
    const position = marker.getPosition?.()
    if (position) {
      bounds.extend(position)
    }
  })

  ;(window as any).markers = markers

  if (markers.length > 0) {
    map.fitBounds(bounds)
  }
}

function updateMapVisibility(visibleDays: number[]) {
  const markers = (window as any).markers as any[] | undefined
  if (!Array.isArray(markers)) {
    return
  }

  markers.forEach((marker, index) => {
    const dayNumber = index + 1
    if (marker?.setVisible) {
      marker.setVisible(visibleDays.includes(dayNumber))
    }
  })
}


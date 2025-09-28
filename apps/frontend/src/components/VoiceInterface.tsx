import { useState } from 'react'
import { ApiConfig } from '../utils/apiConfig'
import { markTripPlanPending, sendTripPlanToVoiceWorker } from '../utils/voiceWorker'

interface VoiceInterfaceProps {}

interface ItineraryResponse {
  city: string
  days: number
  itinerary: any[]
  locations: any[]
  tips: string[]
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = () => {
  const [city, setCity] = useState('Paris')
  const [days, setDays] = useState(3)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isListening, setIsListening] = useState(false)

  const handleLaunchTrip = async () => {
    if (!city.trim() || days < 1) {
      setError('Please enter a valid city and number of days')
      return
    }

    setIsProcessing(true)
    setError(null)
    markTripPlanPending()

    try {
      const data = await ApiConfig.fetchJson<ItineraryResponse>('/api/itinerary', {
        method: 'POST',
        body: JSON.stringify({
          city: city.trim(),
          days: days,
        }),
      })

      // Store itinerary data in session storage for other components
      sessionStorage.setItem('currentItinerary', JSON.stringify(data))
      sessionStorage.setItem('currentCity', city)
      sessionStorage.setItem('currentDays', days.toString())

      // Trigger map update if available
      if ((window as any).travelMap && data.locations) {
        updateMapWithItinerary(data.locations)
      }

      sendTripPlanToVoiceWorker(data, {
        prompt: `Route planning context for ${city} (${days} day${days > 1 ? 's' : ''})`,
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsProcessing(false)
    }
  }

  const updateMapWithItinerary = (locations: any[]) => {
    const map = (window as any).travelMap
    if (!map) return

    // Clear existing markers
    if ((window as any).markers) {
      ;(window as any).markers.forEach((marker: any) => marker.setMap(null))
    }

    const markers: any[] = []
    const bounds = new window.google.maps.LatLngBounds()

    locations.forEach((location, index) => {
      const marker = new window.google.maps.Marker({
        position: { lat: location.lat, lng: location.lng },
        map: map,
        title: location.name,
        label: (index + 1).toString(),
      })

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div class="info-window">
            <h4>${location.name}</h4>
            <p><strong>Day ${location.day}</strong></p>
            <p>${location.description || ''}</p>
            ${location.address ? `<p><small>${location.address}</small></p>` : ''}
          </div>
        `,
      })

      marker.addListener('click', () => {
        infoWindow.open(map, marker)
      })

      markers.push(marker)
      bounds.extend(marker.getPosition())
    })

    // Store markers globally
    ;(window as any).markers = markers

    // Fit map to show all markers
    if (markers.length > 0) {
      map.fitBounds(bounds)
    }
  }

  const handleRetry = () => {
    setError(null)
    handleLaunchTrip()
  }

  return (
    <div className="hexagon-interface">
      <div className="hexagon-content">

        <button 
          className={`hex-mic-button ${isListening ? 'listening' : ''}`}
          onClick={() => setIsListening(!isListening)}
          disabled={isProcessing}
        >
          <svg viewBox="0 0 24 24" width="24" height="24">
            <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 1 1-8 0V6a4 4 0 0 1 4-4z"/>
            <path d="M19 10a7 7 0 0 1-14 0"/>
            <path d="M12 19v4M8 23h8"/>
          </svg>
        </button>

        <div className="hex-inputs">
          <input
            id="hex-city-input"
            type="text"
            placeholder="Enter city name"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={isProcessing}
          />
          <input
            id="hex-days-input"
            type="number"
            min="1"
            max="14"
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value) || 1)}
            disabled={isProcessing}
          />
        </div>

        <button
          className="hex-launch-button"
          onClick={handleLaunchTrip}
          disabled={isProcessing || !city.trim() || days < 1}
        >
          {isProcessing ? 'Planning...' : 'Launch Trip'}
        </button>

        {error && (
          <button
            className="hex-retry-button"
            onClick={handleRetry}
            disabled={isProcessing}
          >
            Retry Planning
          </button>
        )}
      </div>
    </div>
  )
}

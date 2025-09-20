import React, { useEffect, useRef, useState } from 'react'

interface MapInterfaceProps {
  onMapReady: () => void
}

declare global {
  interface Window {
    google: any
    initMap: () => void
  }
}

export const MapInterface: React.FC<MapInterfaceProps> = ({ onMapReady }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('')

  useEffect(() => {
    // Get Google Maps API key from backend
    fetch('/api/config')
      .then(response => response.json())
      .then(data => {
        if (data.google_maps_api_key) {
          setGoogleMapsApiKey(data.google_maps_api_key)
        } else {
          console.error('No Google Maps API key configured')
        }
      })
      .catch(error => {
        console.error('Failed to get Google Maps config:', error)
      })
  }, [])

  useEffect(() => {
    if (!googleMapsApiKey || mapLoaded) return

    // Load Google Maps script
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry&v=beta&callback=initMap`
    script.async = true
    script.defer = true

    // Set up the callback
    window.initMap = () => {
      if (mapRef.current) {
        const map = new window.google.maps.Map(mapRef.current, {
          zoom: 10,
          center: { lat: 48.8566, lng: 2.3522 }, // Paris default
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: true,
          zoomControl: true,
        })

        // Store map instance globally for other components
        ;(window as any).travelMap = map
        setMapLoaded(true)
        onMapReady()
      }
    }

    script.onerror = () => {
      console.error('Failed to load Google Maps')
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
      delete window.initMap
    }
  }, [googleMapsApiKey, mapLoaded, onMapReady])

  return (
    <div id="map" ref={mapRef}>
      {!mapLoaded && (
        <div className="loading">
          <p>🗺️ Ready to plan your trip?</p>
          <p><small>Enter a city & days, then click <em>Launch Trip</em>.</small></p>
        </div>
      )}
    </div>
  )
}

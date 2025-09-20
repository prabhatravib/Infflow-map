import React, { useEffect, useRef, useState } from 'react'
import { ApiConfig } from '../utils/apiConfig'

interface MapInterfaceProps {
  onMapReady: () => void
}

declare global {
  interface Window {
    google: any
    initMap?: () => void
  }
}

export const MapInterface: React.FC<MapInterfaceProps> = ({ onMapReady }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('')

  useEffect(() => {
    // Get Google Maps API key from backend
    ApiConfig.fetchJson<{ google_maps_api_key: string }>('/api/config')
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

    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initializeMap()
      return
    }

    // Check if script is already loading or loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      // Wait for it to load and then initialize
      const checkLoaded = () => {
        if (window.google && window.google.maps) {
          initializeMap()
        } else {
          setTimeout(checkLoaded, 100)
        }
      }
      checkLoaded()
      return
    }

    // Load Google Maps script directly (no cleanup needed)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry&v=beta&callback=initMap`
    script.async = true
    script.defer = true
    
    // Set up the callback
    window.initMap = initializeMap
    
    script.onerror = () => {
      console.error('Failed to load Google Maps')
    }
    
    document.head.appendChild(script)

    // No cleanup function - let browser handle script lifecycle
  }, [googleMapsApiKey, mapLoaded, onMapReady])

  const initializeMap = () => {
    if (mapRef.current && window.google && window.google.maps) {
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

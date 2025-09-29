import React, { useEffect, useRef, useState } from 'react'
import { ApiConfig } from '../utils/apiConfig'
import { renderPendingTripIfAvailable } from '../utils/mapRenderer'

interface MapInterfaceProps {
  onMapReady: () => void
}

declare global {
  interface Window {
    google?: any
    initMap?: () => void
  }
}

export const MapInterface: React.FC<MapInterfaceProps> = ({ onMapReady }) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState<string>('')
  const styleMapId = 'c3bdabd61cc122adbb5aee9d'

  useEffect(() => {
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

    if (window.google && window.google.maps) {
      initializeMap()
      return
    }

    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
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

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=geometry,marker&v=beta&map_ids=${styleMapId}&callback=initMap&loading=async`
    script.async = true
    script.defer = true

    window.initMap = initializeMap

    script.onerror = () => {
      console.error('Failed to load Google Maps')
    }

    document.head.appendChild(script)
  }, [googleMapsApiKey, mapLoaded, onMapReady])

  const initializeMap = () => {
    if (!mapRef.current || !window.google || !window.google.maps) return

    mapRef.current.innerHTML = ''

    const map = new window.google.maps.Map(mapRef.current, {
      mapId: styleMapId,
      zoom: 10,
      center: { lat: 48.8566, lng: 2.3522 },
      disableDefaultUI: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      rotateControl: false,
      tiltControl: false,
      scaleControl: false,
    })

    ;(window as any).travelMap = map
    setMapLoaded(true)
    onMapReady()
    renderPendingTripIfAvailable()
  }

  return (
    <div className="map-wrapper">
      <div id="map" ref={mapRef} aria-label="Travel map" />

      {!mapLoaded && (
        <div className="map-loading" role="status">
          <p>Ready to plan your trip?</p>
          <p><small>Enter a city and days, then click <em>Launch Trip</em>.</small></p>
        </div>
      )}
    </div>
  )
}

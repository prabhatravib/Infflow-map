import React, { useEffect, useRef, useState } from 'react'
import { ApiConfig } from '../utils/apiConfig'
import { renderPendingTripIfAvailable } from '../utils/mapRenderer'

const DIAGONAL_VIEW_HEADING = 235
const DIAGONAL_VIEW_TILT = 45
const TOGGLE_DATA_ATTR = 'data-diagonal-toggle'

function attachDiagonalViewToggle(map: any, container?: HTMLElement | null) {
  const viewButton = document.createElement('button')
  viewButton.type = 'button'
  viewButton.setAttribute(TOGGLE_DATA_ATTR, 'true')
  viewButton.setAttribute('aria-label', 'Toggle diagonal map view')
  viewButton.style.cssText = `
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 44px;
    height: 44px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
    cursor: pointer;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    transition: all 0.2s ease;
  `

  let isDiagonal = true

  const setDiagonalView = () => {
    map.setTilt(DIAGONAL_VIEW_TILT)
    map.setHeading(DIAGONAL_VIEW_HEADING)
    viewButton.innerHTML = '📏'
    viewButton.title = 'Switch to top-down view'
    viewButton.style.background = 'rgba(25, 118, 210, 0.9)'
    viewButton.style.color = 'white'
    viewButton.setAttribute('aria-pressed', 'true')
    isDiagonal = true
  }

  const setTopDownView = () => {
    map.setTilt(0)
    map.setHeading(0)
    viewButton.innerHTML = '📐'
    viewButton.title = 'Switch to diagonal view'
    viewButton.style.background = 'rgba(255, 255, 255, 0.9)'
    viewButton.style.color = '#333'
    viewButton.setAttribute('aria-pressed', 'false')
    isDiagonal = false
  }

  viewButton.addEventListener('click', () => {
    if (isDiagonal) {
      setTopDownView()
    } else {
      setDiagonalView()
    }
  })

  setDiagonalView()

  const host = container ?? (map.getDiv()?.parentElement as HTMLElement | null) ?? map.getDiv()
  if (host) {
    const existingToggle = host.querySelector(`[${TOGGLE_DATA_ATTR}]`)
    existingToggle?.remove()
    host.appendChild(viewButton)
  }
}

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

    attachDiagonalViewToggle(map, mapRef.current?.parentElement)

    ;(window as any).travelMap = map

    const maps = window.google.maps
    maps.event.addListenerOnce(map, 'tilesloaded', () => {
      map.setHeading(DIAGONAL_VIEW_HEADING)
      map.setTilt(DIAGONAL_VIEW_TILT)
      setMapLoaded(true)
      onMapReady()
      renderPendingTripIfAvailable()
    })
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

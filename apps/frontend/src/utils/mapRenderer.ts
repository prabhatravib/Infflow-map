import { TripData } from './tripTypes'

const MAP_STATE = {
  markers: [] as any[],
  routes: [] as any[],
  dayVisibility: new Map<number, boolean>(),
}

const CITY_CENTER_CACHE = new Map<string, { lat: number; lng: number }>()

declare global {
  interface Window {
    travelMap?: any
    google?: any
    _directionsService?: any
  }
}

let pendingTrip: TripData | null = null

function getMap(): any {
  return (window as any).travelMap
}

function getGoogleMaps(): any {
  return (window as any).google?.maps
}

function getOrCreateDirectionsService(): any {
  const maps = getGoogleMaps()
  if (!maps) return undefined
  const w = window as any
  if (!w._directionsService) {
    w._directionsService = new maps.DirectionsService()
  }
  return w._directionsService
}

function getOrCreateGeocoder(): any {
  const maps = getGoogleMaps()
  if (!maps) return undefined
  const w = window as any
  if (!w._geocoder) {
    w._geocoder = new maps.Geocoder()
  }
  return w._geocoder
}

export function clearTripRender() {
  MAP_STATE.markers.forEach((marker) => {
    if (marker) {
      marker.map = null
      marker.infoWindow?.close?.()
    }
  })
  MAP_STATE.routes.forEach((route) => {
    if (route?.setMap) {
      route.setMap(null)
    } else if (route) {
      route.map = null
    }
  })

  MAP_STATE.markers = []
  MAP_STATE.routes = []
  MAP_STATE.dayVisibility.clear()

  const dayControls = document.getElementById('day-controls')
  if (dayControls) {
    dayControls.innerHTML = ''
  }
}

export function renderTripOnMap(trip: TripData) {
  if (!trip || !Array.isArray(trip.days)) {
    console.warn('[mapRenderer] Invalid trip payload received', trip)
    return
  }

  const map = getMap()
  const gmaps = getGoogleMaps()
  if (!map || !gmaps) {
    pendingTrip = trip
    return
  }

  pendingTrip = null

  clearTripRender()

  const bounds = new gmaps.LatLngBounds()

  trip.days.forEach((day, dayIndex) => {
    if (!day || !Array.isArray(day.stops)) {
      return
    }

    day.stops.forEach((stop, stopIndex) => {
      if (!isFinite(stop.lat) || !isFinite(stop.lng)) return

      const isVisible = dayIndex === 0

      const pinElement = new gmaps.marker.PinElement({
        background: getColourForDay(dayIndex),
        borderColor: '#FFFFFF',
        glyphColor: '#FFFFFF',
        scale: 1.0,
      })

      const marker = new gmaps.marker.AdvancedMarkerElement({
        map: isVisible ? map : null,
        position: { lat: stop.lat, lng: stop.lng },
        title: stop.name,
        content: pinElement.element,
        zIndex: -1000 - stopIndex,
      })

      const infoWindow = new gmaps.InfoWindow({
        content: `
          <div class="info-window-content">
            <h4>${stop.name}</h4>
            <p>${day.label || `Day ${dayIndex + 1}`} • Stop ${stopIndex + 1}</p>
            ${stop.description ? `<p>${stop.description}</p>` : ''}
            ${stop.address ? `<p><small>${stop.address}</small></p>` : ''}
          </div>
        `,
      })

      marker.addListener('click', () => {
        infoWindow.open({
          map,
          anchor: marker,
        })
      })

      ;(marker as any).infoWindow = infoWindow
      ;(marker as any).dayIndex = dayIndex

      MAP_STATE.markers.push(marker)
      const position = marker.position || marker.getPosition?.()
      if (position) {
        bounds.extend(position)
      }
    })
  })

  drawRoutes(trip)

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds)
  } else if (trip.metadata?.center) {
    centerMapOnCoordinates(trip.metadata.center)
  } else if (trip.metadata?.city) {
    centerMapOnCity(trip.metadata.city)
  }

  setupDayControls(trip)
}

function drawRoutes(trip: TripData) {
  const directionsService = getOrCreateDirectionsService()
  const map = getMap()
  const gmaps = getGoogleMaps()
  if (!directionsService || !map || !gmaps) return

  trip.days.forEach((day, dayIndex) => {
    const validStops = day.stops.filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
    if (validStops.length < 2) return

    const origin = validStops[0]
    const destination = validStops[validStops.length - 1]
    const waypoints = validStops.slice(1, -1).map((stop) => ({
      location: { lat: stop.lat, lng: stop.lng },
      stopover: true,
    }))

    directionsService.route(
      {
        origin,
        destination,
        waypoints,
        travelMode: gmaps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result: any, status: string) => {
        if (status === 'OK' && result) {
          const legs = result.routes?.[0]?.legs ?? []
          const travelTimes = legs.map((leg: any) => leg?.duration?.text)
          createRouteSegments(validStops, dayIndex, travelTimes)
        } else {
          createRouteSegments(validStops, dayIndex)
        }
      }
    )
  })
}

function createRouteSegments(stops: TripData['days'][number]['stops'], dayIndex: number, travelTimes?: (string | undefined)[]) {
  if (!Array.isArray(stops) || stops.length < 2) {
    return
  }

  const map = getMap()
  const gmaps = getGoogleMaps()
  if (!map || !gmaps) return

  for (let i = 0; i < stops.length - 1; i += 1) {
    const start = stops[i]
    const end = stops[i + 1]
    const visibleState = MAP_STATE.dayVisibility.get(dayIndex)
    const isVisible = visibleState !== undefined ? visibleState : dayIndex === 0

    const curve = createBezierCurve(start, end)
    const polyline = new gmaps.Polyline({
      path: curve,
      geodesic: false,
      strokeColor: '#2196f3',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: isVisible ? map : null,
    })

    ;(polyline as any).dayIndex = dayIndex
    MAP_STATE.routes.push(polyline)

    const timeText = travelTimes?.[i] ?? estimateDrivingTime(start, end)
    const label = createTimeLabel(start, end, timeText, isVisible)
    ;(label as any).dayIndex = dayIndex
    MAP_STATE.routes.push(label)
  }
}

function createBezierCurve(start: { lat: number; lng: number }, end: { lat: number; lng: number }) {
  const steps = 50
  const points: { lat: number; lng: number }[] = []

  const dx = end.lng - start.lng
  const dy = end.lat - start.lat
  const distance = Math.sqrt(dx * dx + dy * dy)
  const offsetScale = Math.min(0.15, distance * 2)
  const midX = (start.lng + end.lng) / 2 - dy * offsetScale
  const midY = (start.lat + end.lat) / 2 + dx * offsetScale

  for (let t = 0; t <= 1; t += 1 / steps) {
    const x = (1 - t) * (1 - t) * start.lng + 2 * (1 - t) * t * midX + t * t * end.lng
    const y = (1 - t) * (1 - t) * start.lat + 2 * (1 - t) * t * midY + t * t * end.lat
    points.push({ lat: y, lng: x })
  }

  return points
}

function createTimeLabel(start: { lat: number; lng: number }, end: { lat: number; lng: number }, text: string, visible: boolean) {
  const gmaps = getGoogleMaps()
  if (!gmaps) throw new Error('Google maps not available')

  const midLat = (start.lat + end.lat) / 2
  const midLng = (start.lng + end.lng) / 2
  const dx = end.lng - start.lng
  const dy = end.lat - start.lat
  const offsetScale = Math.min(0.075, Math.sqrt(dx * dx + dy * dy))
  const labelLat = midLat + dx * offsetScale
  const labelLng = midLng - dy * offsetScale

  const labelDiv = document.createElement('div')
  labelDiv.style.cssText = `
    background: white;
    border: 2px solid #2196f3;
    border-radius: 16px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    color: #1976d2;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    white-space: nowrap;
  `
  labelDiv.textContent = text

  return new gmaps.marker.AdvancedMarkerElement({
    position: { lat: labelLat, lng: labelLng },
    map: visible ? getMap() : null,
    content: labelDiv,
    zIndex: 1000,
  })
}

function estimateDrivingTime(start: { lat: number; lng: number }, end: { lat: number; lng: number }) {
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

function setupDayControls(trip: TripData) {
  const containerId = 'day-controls'
  let container = document.getElementById(containerId)
  if (!container) {
    container = document.createElement('div')
    container.id = containerId
    container.className = 'day-controls'
    const mapWrapper = document.querySelector('.map-wrapper')
    mapWrapper?.appendChild(container)
  }

  trip.days.forEach((day, index) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'day-controls__item'

    const label = document.createElement('label')
    label.textContent = day.label || `Day ${index + 1}`
    label.style.color = getColourForDay(index)

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = index === 0

    MAP_STATE.dayVisibility.set(index, index === 0)

    checkbox.addEventListener('change', () => {
      MAP_STATE.dayVisibility.set(index, checkbox.checked)
      toggleDayVisibility(index, checkbox.checked)
    })

    wrapper.appendChild(label)
    wrapper.appendChild(checkbox)
    container?.appendChild(wrapper)
  })

  // Apply initial visibility after controls created
  trip.days.forEach((_, index) => {
    const isVisible = MAP_STATE.dayVisibility.get(index) ?? false
    toggleDayVisibility(index, isVisible)
  })
}

function toggleDayVisibility(dayIndex: number, visible: boolean) {
  MAP_STATE.markers.forEach((marker: any) => {
    if (marker.dayIndex === dayIndex) {
      marker.map = visible ? getMap() : null
      if (!visible) {
        marker.infoWindow?.close?.()
      }
    }
  })

  MAP_STATE.routes.forEach((route: any) => {
    if (route.dayIndex === dayIndex) {
      if (route.setMap) {
        route.setMap(visible ? getMap() : null)
      } else {
        route.map = visible ? getMap() : null
      }
    }
  })
}

function getColourForDay(dayIndex: number) {
  const baseColours = ['#2196f3', '#f44336', '#4caf50', '#ff9800', '#9c27b0', '#009688', '#3f51b5']
  return baseColours[dayIndex % baseColours.length]
}

export function renderPendingTripIfAvailable() {
  if (pendingTrip) {
    const trip = pendingTrip
    pendingTrip = null
    renderTripOnMap(trip).catch((error) => console.error('Failed to render pending trip', error))
  }
}

function centerMapOnCity(city: string) {
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

function centerMapOnCoordinates(center: { lat: number; lng: number }) {
  const map = getMap()
  if (!map) return

  if (!Number.isFinite(center.lat) || !Number.isFinite(center.lng)) return

  map.setCenter(center)
  map.setZoom(12)
  const cacheKey = `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`
  CITY_CENTER_CACHE.set(cacheKey, center)
}


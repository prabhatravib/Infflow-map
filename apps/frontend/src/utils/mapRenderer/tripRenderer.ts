import { TripData } from '../tripTypes'
import {
  MAP_STATE,
  getMap,
  getGoogleMaps,
  getOrCreateDirectionsService,
  resetMapState,
} from './state'
import { ensureInitialDayCamera, enableDiagonalToggle, toggleDayCamera } from './camera'
import { clearDayControls, toggleDayVisibility } from './dayControls'
import { estimateDrivingTime, getColourForDay, toLatLngLiteral, LatLngLiteral } from './utils'
import { getPendingTrip, setPendingTrip } from './tripState'
import { centerMapOnCity, centerMapOnCoordinates } from './mapCentering'
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

  resetMapState()
  enableDiagonalToggle()
  clearDayControls()
}

export function renderTripOnMap(trip: TripData) {
  if (!trip || !Array.isArray(trip.days)) {
    console.warn('[mapRenderer] Invalid trip payload received', trip)
    return
  }

  const map = getMap()
  const gmaps = getGoogleMaps()
  if (!map || !gmaps) {
    setPendingTrip(trip)
    return
  }

  setPendingTrip(null)

  clearTripRender()

  const bounds = new gmaps.LatLngBounds()

  trip.days.forEach((day, dayIndex) => {
    if (!day || !Array.isArray(day.stops)) {
      return
    }

    const dayStopCoords: LatLngLiteral[] = []

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

      const infoWindowContent = document.createElement('div')
      infoWindowContent.className = 'info-window-content'
      infoWindowContent.innerHTML = `
        <div class="info-window-header">
          <h4>${stop.name}</h4>
          <button type="button" class="info-window-close" aria-label="Close info window">×</button>
        </div>
        <p>${day.label || `Day ${dayIndex + 1}`} • Stop ${stopIndex + 1}</p>
        ${stop.description ? `<p>${stop.description}</p>` : ''}
      `

      const infoWindow = new gmaps.InfoWindow({
        content: infoWindowContent,
      })

      const closeButton = infoWindowContent.querySelector<HTMLButtonElement>('.info-window-close')
      closeButton?.addEventListener('click', () => {
        infoWindow.close()
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
      const literal = toLatLngLiteral(position)
      if (literal) {
        bounds.extend(literal)
        dayStopCoords.push(literal)
      }
    })

    if (dayStopCoords.length > 0) {
      MAP_STATE.dayStops.set(dayIndex, dayStopCoords)
    }
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

function createRouteSegments(
  stops: TripData['days'][number]['stops'],
  dayIndex: number,
  travelTimes?: (string | undefined)[]
) {
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

function createTimeLabel(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  text: string,
  visible: boolean
) {
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

function setupDayControls(trip: TripData) {
  const containerId = 'day-controls'
  let container = document.getElementById(containerId)
  if (!container) {
    container = document.createElement('div')
    container.id = containerId
    container.className = 'day-controls'
    document.body.appendChild(container)
  } else if (container.parentElement !== document.body) {
    document.body.appendChild(container)
  }

  Object.assign(container.style, {
    position: 'fixed',
    top: '1.5rem',
    right: '1.5rem',
    left: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    padding: '0.4rem 0.55rem',
    borderRadius: '12px',
    background: 'rgba(17, 24, 39, 0.82)',
    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
    color: '#f9fafb',
    width: '160px',
    pointerEvents: 'auto',
    zIndex: '1100',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: '0.85rem',
  })

  trip.days.forEach((day, index) => {
    const wrapper = document.createElement('label')
    wrapper.style.display = 'flex'
    wrapper.style.alignItems = 'center'
    wrapper.style.justifyContent = 'space-between'
    wrapper.style.gap = '0.25rem'
    wrapper.style.width = '100%'
    wrapper.style.cursor = 'pointer'

    const text = document.createElement('span')
    text.textContent = day.label || `Day ${index + 1}`
    text.style.color = getColourForDay(index)
    text.style.fontWeight = '600'

    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = index === 0
    Object.assign(checkbox.style, {
      width: '16px',
      height: '16px',
      margin: '0',
      cursor: 'pointer',
      flexShrink: '0',
    })

    MAP_STATE.dayVisibility.set(index, index === 0)

    checkbox.addEventListener('change', () => {
      MAP_STATE.dayVisibility.set(index, checkbox.checked)
      toggleDayCamera(index, checkbox.checked)
    })

    wrapper.appendChild(text)
    wrapper.appendChild(checkbox)
    container?.appendChild(wrapper)
  })

  // Apply initial visibility after controls created
  trip.days.forEach((_, index) => {
    const isVisible = MAP_STATE.dayVisibility.get(index) ?? false
    toggleDayVisibility(index, isVisible)
  })

  ensureInitialDayCamera()
}

export function renderPendingTripIfAvailable() {
  const pendingTrip = getPendingTrip()
  if (pendingTrip) {
    setPendingTrip(null)
    try {
      renderTripOnMap(pendingTrip)
    } catch (error: unknown) {
      console.error('Failed to render pending trip', error)
    }
  }
}


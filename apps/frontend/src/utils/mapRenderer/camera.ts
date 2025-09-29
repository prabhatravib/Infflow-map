import { BIRD_VIEW_TILT, DAY_VIEW_PADDING, DIAGONAL_TOGGLE_SELECTOR, MAP_STATE, SINGLE_STOP_HEADING, getGoogleMaps, getMap } from './state'
import { toggleDayVisibility } from './dayControls'

export function disableDiagonalToggle() {
  const toggle = document.querySelector<HTMLButtonElement>(DIAGONAL_TOGGLE_SELECTOR)
  if (!toggle) return

  toggle.disabled = true
  toggle.setAttribute('aria-disabled', 'true')
  toggle.title = 'Bird view locked for this day'
  toggle.style.opacity = '0.4'
  toggle.style.cursor = 'not-allowed'
}

export function enableDiagonalToggle() {
  const toggle = document.querySelector<HTMLButtonElement>(DIAGONAL_TOGGLE_SELECTOR)
  if (!toggle) return

  toggle.disabled = false
  toggle.setAttribute('aria-disabled', 'false')
  toggle.style.opacity = '1'
  toggle.style.cursor = 'pointer'
  toggle.title = toggle.getAttribute('aria-pressed') === 'true' ? 'Switch to top-down view' : 'Switch to diagonal view'
}

export function focusAnyVisibleDay(previousDayIndex: number): boolean {
  const visibleDays = Array.from(MAP_STATE.dayVisibility.entries())
    .filter(([, isVisible]) => isVisible)
    .map(([index]) => index)
    .sort((a, b) => a - b)

  if (visibleDays.length === 0) {
    return false
  }

  const nextDay = visibleDays.find((index) => index !== previousDayIndex)
  if (nextDay === undefined) {
    return false
  }

  return updateMapCameraForDay(nextDay)
}

export function ensureInitialDayCamera() {
  const visibleDays = Array.from(MAP_STATE.dayVisibility.entries())
    .filter(([, visible]) => visible)
    .map(([index]) => index)
    .sort((a, b) => a - b)

  if (visibleDays.length === 0) {
    enableDiagonalToggle()
    MAP_STATE.currentDayIndex = null
    return
  }

  updateMapCameraForDay(visibleDays[0])
}

export function updateMapCameraForDay(dayIndex: number): boolean {
  const map = getMap()
  const gmaps = getGoogleMaps()
  if (!map || !gmaps) return false

  const stops = MAP_STATE.dayStops.get(dayIndex)
  if (!stops || stops.length === 0) {
    return false
  }

  if (stops.length === 1) {
    if (map.moveCamera) {
      map.moveCamera({
        heading: SINGLE_STOP_HEADING,
        tilt: BIRD_VIEW_TILT,
        center: stops[0],
      })
    } else {
      map.setHeading?.(SINGLE_STOP_HEADING)
      map.setTilt?.(BIRD_VIEW_TILT)
      map.panTo?.(stops[0])
    }
    MAP_STATE.currentDayIndex = dayIndex
    disableDiagonalToggle()
    return true
  }

  const origin = stops[0]
  const destination = stops[stops.length - 1]

  const heading = gmaps.geometry?.spherical?.computeHeading(origin, destination)
  const normalisedHeading = Number.isFinite(heading) ? (heading + 360) % 360 : SINGLE_STOP_HEADING

  MAP_STATE.currentDayIndex = dayIndex
  disableDiagonalToggle()

  const bounds = new gmaps.LatLngBounds()
  stops.forEach((stop) => bounds.extend(stop))
  map.fitBounds(bounds, DAY_VIEW_PADDING)
  const center = map.getCenter?.()
  if (center && typeof center.lat === 'function' && typeof center.lng === 'function') {
    map.moveCamera?.({
      heading: normalisedHeading,
      tilt: BIRD_VIEW_TILT,
      center: { lat: center.lat(), lng: center.lng() },
    })
  } else {
    map.setHeading?.(normalisedHeading)
    map.setTilt?.(BIRD_VIEW_TILT)
  }

  return true
}

export function toggleDayCamera(dayIndex: number, visible: boolean) {
  toggleDayVisibility(dayIndex, visible)

  if (visible) {
    const updated = updateMapCameraForDay(dayIndex)
    if (!updated) {
      MAP_STATE.currentDayIndex = null
      enableDiagonalToggle()
    }
  } else if (MAP_STATE.currentDayIndex === dayIndex) {
    if (!focusAnyVisibleDay(dayIndex)) {
      MAP_STATE.currentDayIndex = null
      enableDiagonalToggle()
    }
  }
}


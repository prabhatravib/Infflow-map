export const BIRD_VIEW_TILT = 60
export const SINGLE_STOP_HEADING = 225
export const DIAGONAL_TOGGLE_SELECTOR = '[data-diagonal-toggle]'
export const DAY_VIEW_PADDING = { top: 96, bottom: 120, left: 96, right: 96 }

export const MAP_STATE = {
  markers: [] as any[],
  routes: [] as any[],
  dayVisibility: new Map<number, boolean>(),
  dayStops: new Map<number, { lat: number; lng: number }[]>(),
  currentDayIndex: null as number | null,
}

export const CITY_CENTER_CACHE = new Map<string, { lat: number; lng: number }>()

declare global {
  interface Window {
    travelMap?: any
    google?: any
    _directionsService?: any
    _geocoder?: any
  }
}

export function getMap(): any {
  return (window as any).travelMap
}

export function getGoogleMaps(): any {
  return (window as any).google?.maps
}

export function getOrCreateDirectionsService(): any {
  const maps = getGoogleMaps()
  if (!maps) return undefined
  const w = window as any
  if (!w._directionsService) {
    w._directionsService = new maps.DirectionsService()
  }
  return w._directionsService
}

export function getOrCreateGeocoder(): any {
  const maps = getGoogleMaps()
  if (!maps) return undefined
  const w = window as any
  if (!w._geocoder) {
    w._geocoder = new maps.Geocoder()
  }
  return w._geocoder
}

export function resetMapState() {
  MAP_STATE.markers = []
  MAP_STATE.routes = []
  MAP_STATE.dayVisibility.clear()
  MAP_STATE.dayStops.clear()
  MAP_STATE.currentDayIndex = null
}


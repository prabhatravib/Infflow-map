import { MAP_STATE, getMap } from './state'

export function clearDayControls() {
  const dayControls = document.getElementById('day-controls')
  if (dayControls) {
    dayControls.innerHTML = ''
  }
}

export function toggleDayVisibility(dayIndex: number, visible: boolean) {
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


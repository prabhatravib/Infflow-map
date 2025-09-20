import React, { useState, useEffect } from 'react'

export const DayControls: React.FC = () => {
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [maxDays, setMaxDays] = useState(3)

  useEffect(() => {
    // Get current itinerary data
    const itineraryData = sessionStorage.getItem('currentItinerary')
    if (itineraryData) {
      try {
        const itinerary = JSON.parse(itineraryData)
        if (itinerary.days) {
          setMaxDays(itinerary.days)
          // Select all days by default
          setSelectedDays(Array.from({ length: itinerary.days }, (_, i) => i + 1))
        }
      } catch (error) {
        console.error('Failed to parse itinerary data:', error)
      }
    }
  }, [])

  const handleDayToggle = (day: number) => {
    setSelectedDays(prev => {
      if (prev.includes(day)) {
        return prev.filter(d => d !== day)
      } else {
        return [...prev, day].sort()
      }
    })
  }

  const updateMapVisibility = (visibleDays: number[]) => {
    if ((window as any).markers) {
      const markers = (window as any).markers
      markers.forEach((marker: any, index: number) => {
        const dayNumber = index + 1
        const isVisible = visibleDays.includes(dayNumber)
        marker.setVisible(isVisible)
      })
    }
  }

  useEffect(() => {
    updateMapVisibility(selectedDays)
  }, [selectedDays])

  if (maxDays <= 1) {
    return null
  }

  return (
    <div id="day-controls">
      {Array.from({ length: maxDays }, (_, i) => i + 1).map(day => (
        <div key={day}>
          <label htmlFor={`day-${day}`}>
            Day {day}
          </label>
          <input
            id={`day-${day}`}
            type="checkbox"
            checked={selectedDays.includes(day)}
            onChange={() => handleDayToggle(day)}
          />
        </div>
      ))}
    </div>
  )
}

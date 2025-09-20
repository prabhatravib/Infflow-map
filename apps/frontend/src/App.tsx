import { useEffect, useState } from 'react'
import { MapInterface } from './components/MapInterface'
import { VoiceInterface } from './components/VoiceInterface'
import { ChatPanel } from './components/ChatPanel'
import { DayControls } from './components/DayControls'
import { VoiceInitializer } from './components/VoiceInitializer'
import { SocketIOLoader } from './utils/SocketIOLoader'
import './App.css'

function App() {
  const [socketLoaded, setSocketLoaded] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    // Load Socket.IO
    SocketIOLoader.load().then(() => {
      setSocketLoaded(true)
    }).catch((error) => {
      console.error('Failed to load Socket.IO:', error)
    })
  }, [])

  if (!socketLoaded) {
    return (
      <div className="loading">
        <p>🗺️ Loading Infflow Map...</p>
        <p><small>Initializing voice interface...</small></p>
      </div>
    )
  }

  return (
    <div className="app">
      {/* SVG Definitions for Hexagon with Rounded Corners */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <clipPath id="roundedHex" clipPathUnits="objectBoundingBox">
            <path d="
              M 0.50 0.00
              L 0.85 0.18   Q 0.92 0.22 0.92 0.25
              L 0.92 0.75   Q 0.92 0.78 0.85 0.82
              L 0.50 1.00
              L 0.15 0.82   Q 0.08 0.78 0.08 0.75
              L 0.08 0.25   Q 0.08 0.22 0.15 0.18 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Map Interface */}
      <MapInterface onMapReady={() => setMapReady(true)} />

      {/* Voice Interface */}
      <VoiceInterface />

      {/* Chat Panel */}
      <ChatPanel />

      {/* Day Controls */}
      <DayControls />

      {/* Voice Initializer */}
      {mapReady && <VoiceInitializer />}
    </div>
  )
}

export default App

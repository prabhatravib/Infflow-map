import { MapInterface } from './components/MapInterface'
import { ChatPanel } from './components/ChatPanel'
import { TripControls } from './components/TripControls'
import { VoiceWorkerFrame } from './components/VoiceWorkerFrame'
import styles from './App.module.css'

function App() {
  return (
    <div className={styles.app} id="app-root">
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

      <MapInterface onMapReady={() => {}} />
      <ChatPanel />
      <TripControls />
      <VoiceWorkerFrame />
    </div>
  )
}

export default App

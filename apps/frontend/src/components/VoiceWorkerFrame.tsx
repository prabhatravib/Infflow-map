import { useEffect, useState } from 'react'
import {
  VOICE_WORKER_EVENTS,
  enableVoiceWorker,
  disableVoiceWorker,
  getVoiceWorkerIframeUrl,
  getTripPlanStatus,
  isVoiceWorkerEnabled,
  TripPlanStatus,
} from '../utils/voiceWorker'

export function VoiceWorkerFrame() {
  const [enabled, setEnabled] = useState<boolean>(() => isVoiceWorkerEnabled())
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<TripPlanStatus>(() => getTripPlanStatus())

  useEffect(() => {
    const handleEnabled = (event: Event) => {
      const detail = (event as CustomEvent<{ enabled: boolean; sessionId?: string }>).detail
      setEnabled(detail.enabled)
      setSessionId(detail.sessionId ?? null)
    }

    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<{ status: TripPlanStatus }>).detail
      setStatus(detail.status)
    }

    window.addEventListener(VOICE_WORKER_EVENTS.enabled, handleEnabled)
    window.addEventListener(VOICE_WORKER_EVENTS.status, handleStatus)

    return () => {
      window.removeEventListener(VOICE_WORKER_EVENTS.enabled, handleEnabled)
      window.removeEventListener(VOICE_WORKER_EVENTS.status, handleStatus)
    }
  }, [])

  const toggleVoice = () => {
    if (enabled) {
      disableVoiceWorker()
      return
    }

    const newSessionId = enableVoiceWorker()
    setSessionId(newSessionId)
  }

  const iframeUrl = sessionId ? getVoiceWorkerIframeUrl(sessionId) : null

  return (
    <div className="voice-worker-container" aria-hidden="false">
      <div className="voice-worker-panel">
        <div className="voice-worker-toggle">
          <span className="voice-worker-label">Voice</span>
          <button
            type="button"
            onClick={toggleVoice}
            className={`voice-worker-switch ${enabled ? 'on' : 'off'}`}
            aria-pressed={enabled}
            aria-label="Toggle voice"
          >
            <span className="voice-worker-switch-handle" />
          </button>
          <span className="voice-worker-value">{enabled ? 'ON' : 'OFF'}</span>
        </div>

        <div className="voice-worker-status">
          <span className={`voice-worker-status-text ${status === 'sent' ? 'sent' : 'pending'}`}>
            {status === 'sent' ? 'Trip Details Sent' : 'Trip Details Not Sent'}
          </span>
        </div>

        <div className="voice-worker-hexagon" aria-live="polite">
          {enabled && iframeUrl ? (
            <iframe
              title="Infflow Voice Companion"
              src={iframeUrl}
              className="voice-worker-iframe"
              allow="microphone"
              loading="lazy"
            />
          ) : (
            <div className="voice-worker-disabled">Voice Disabled</div>
          )}
        </div>
      </div>
    </div>
  )
}

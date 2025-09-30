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
import styles from './VoiceWorkerFrame.module.css'

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

    void enableVoiceWorker().then(setSessionId).catch((error) => {
      console.error('[VoiceWorkerFrame] Failed to enable voice worker:', error)
    })
  }

  const iframeUrl = sessionId ? getVoiceWorkerIframeUrl(sessionId) : null

  return (
    <div className={styles.voiceWorkerContainer} aria-hidden="false">
      <div className={styles.voiceWorkerPanel}>
        <div className={styles.voiceWorkerToggle}>
          <span className={styles.voiceWorkerLabel}>Voice</span>
          <button
            type="button"
            onClick={toggleVoice}
            className={`${styles.voiceWorkerSwitch} ${enabled ? styles.switchOn : styles.switchOff}`}
            aria-pressed={enabled}
            aria-label="Toggle voice"
          >
            <span
              className={`${styles.voiceWorkerSwitchHandle} ${
                enabled ? styles.switchOnHandle : styles.switchOffHandle
              }`}
            />
          </button>
          <span className={styles.voiceWorkerValue}>{enabled ? 'ON' : 'OFF'}</span>
        </div>

        <div className={styles.voiceWorkerHexagon} aria-live="polite">
          {enabled && iframeUrl ? (
            <iframe
              title="Infflow Voice Companion"
              src={iframeUrl}
              className={styles.voiceWorkerIframe}
              allow="microphone"
              loading="lazy"
            />
          ) : (
            <div className={styles.voiceWorkerDisabled}>Voice Disabled</div>
          )}
        </div>

        <div className={styles.voiceWorkerStatusText} aria-live="polite">
          <span
            className={`${styles.voiceWorkerStatus} ${
              status === 'sent' ? styles.statusSent : styles.statusPending
            }`}
          >
            {status === 'sent' ? 'Trip Details Sent' : 'Trip Details Not Sent'}
          </span>
        </div>
      </div>
    </div>
  )
}

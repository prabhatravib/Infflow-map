import { useEffect, useMemo, useState } from 'react'
import {
  VOICE_WORKER_EVENTS,
  enableVoiceWorker,
  disableVoiceWorker,
  getVoiceWorkerIframeUrl,
  getTripPlanStatus,
  isVoiceWorkerEnabled,
  TripPlanStatus,
} from '../utils/voiceWorker'
import { TripSummary } from './TripControls'
import styles from './VoiceWorkerFrame.module.css'

interface VoiceWorkerFrameProps {
  className?: string
  ariaHidden?: boolean
  summary?: TripSummary | null
}

export function VoiceWorkerFrame({ className, ariaHidden = false, summary }: VoiceWorkerFrameProps) {
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
  const summaryLabel = useMemo(() => {
    if (!summary) return null
    const { city, days } = summary
    const dayLabel = days === 1 ? 'day' : 'days'
    return `${city} · ${days} ${dayLabel}`
  }, [summary])

  const rootClassName = [styles.voiceWorkerContainer, className].filter(Boolean).join(' ')

  return (
    <div className={rootClassName} aria-hidden={ariaHidden} data-active={!ariaHidden}>
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

        {summaryLabel && (
          <div className={styles.voiceWorkerSummary} aria-live="polite">
            {summaryLabel}
          </div>
        )}

        <div className={styles.voiceWorkerHexagon} aria-live="polite">
          <div className={styles.voiceWorkerInnerFrame}>
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

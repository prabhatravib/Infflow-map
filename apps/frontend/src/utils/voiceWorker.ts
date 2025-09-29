const VOICE_WORKER_ORIGIN = 'https://hexa-worker.prabhatravib.workers.dev'
const SESSION_STORAGE_KEY = 'voiceWorkerSessionId'
const PLAN_HASH_KEY = 'voiceWorkerLastTripPlanHash'
const STATUS_STORAGE_KEY = 'voiceWorkerTripPlanStatus'

export type TripPlanStatus = 'sent' | 'not-sent'

const EVENT_ENABLED = 'voice-worker:enabled'
const EVENT_STATUS = 'voice-worker:trip-status'

let voiceEnabled = false
let currentSessionId: string | null = null
let tripPlanStatus: TripPlanStatus = 'not-sent'

interface VoiceWorkerEnabledDetail {
  enabled: boolean
  sessionId?: string
}

interface VoiceWorkerStatusDetail {
  status: TripPlanStatus
}

function generateSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch (error) {
    console.warn('[VoiceWorker] sessionStorage unavailable:', error)
    return null
  }
}

function setGlobalSessionId(sessionId: string | null) {
  if (typeof window === 'undefined') return
  if (sessionId) {
    ;(window as any).voiceWorkerSessionId = sessionId
  } else {
    delete (window as any).voiceWorkerSessionId
  }
}

function dispatchVoiceWorkerEvent<T>(name: string, detail: T) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function clearPlanHash(storage = getSessionStorage()) {
  storage?.removeItem(PLAN_HASH_KEY)
}

function setTripPlanStatus(status: TripPlanStatus) {
  tripPlanStatus = status
  const storage = getSessionStorage()
  storage?.setItem(STATUS_STORAGE_KEY, status)
  if (status === 'not-sent') {
    clearPlanHash(storage)
  }
  dispatchVoiceWorkerEvent<VoiceWorkerStatusDetail>(EVENT_STATUS, { status })
}

export function getTripPlanStatus(): TripPlanStatus {
  return tripPlanStatus
}

export function isVoiceWorkerEnabled(): boolean {
  return voiceEnabled
}

export function enableVoiceWorker(): string {
  const storage = getSessionStorage()
  const newSessionId = generateSessionId()

  voiceEnabled = true
  currentSessionId = newSessionId
  setGlobalSessionId(newSessionId)
  storage?.setItem(SESSION_STORAGE_KEY, newSessionId)

  setTripPlanStatus('not-sent')

  dispatchVoiceWorkerEvent<VoiceWorkerEnabledDetail>(EVENT_ENABLED, {
    enabled: true,
    sessionId: newSessionId,
  })

  return newSessionId
}

export function disableVoiceWorker(): void {
  const storage = getSessionStorage()

  voiceEnabled = false
  currentSessionId = null
  setGlobalSessionId(null)
  storage?.removeItem(SESSION_STORAGE_KEY)

  setTripPlanStatus('not-sent')

  dispatchVoiceWorkerEvent<VoiceWorkerEnabledDetail>(EVENT_ENABLED, {
    enabled: false,
  })
}

export function markTripPlanPending(): void {
  if (!voiceEnabled) return
  setTripPlanStatus('not-sent')
}

function normalizePlanToText(plan: unknown): string {
  try {
    if (typeof plan === 'string') {
      return plan
    }
    return JSON.stringify(plan, null, 2)
  } catch (error) {
    console.error('[VoiceWorker] Failed to stringify trip plan:', error)
    return String(plan)
  }
}

function getPlanFingerprint(planText: string): string {
  return planText
}

export interface TripPlanPayload {
  prompt?: string
  type?: string
  textOverride?: string
  image?: string
}

export async function sendTripPlanToVoiceWorker(
  plan: unknown,
  options: TripPlanPayload = {}
) {
  if (!voiceEnabled || !currentSessionId) {
    return
  }

  const serializedPlan = options.textOverride || normalizePlanToText(plan)
  const planHash = getPlanFingerprint(serializedPlan)
  const storage = getSessionStorage()
  const lastHash = storage?.getItem(PLAN_HASH_KEY)

  if (lastHash === planHash) {
    return
  }

  const payload = {
    sessionId: currentSessionId,
    type: options.type || 'trip_plan',
    text: serializedPlan,
    prompt: options.prompt || `Trip plan context for session ${currentSessionId}`,
    ...(options.image ? { image: options.image } : {}),
  }

  try {
    const response = await fetch(`${VOICE_WORKER_ORIGIN}/api/external-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Voice worker responded with ${response.status}`)
    }

    storage?.setItem(PLAN_HASH_KEY, planHash)
    setTripPlanStatus('sent')
  } catch (error) {
    console.error('[VoiceWorker] Failed to send trip plan:', error)
    clearPlanHash(storage)
    setTripPlanStatus('not-sent')
  }
}

export function getVoiceWorkerIframeUrl(sessionId: string) {
  return `${VOICE_WORKER_ORIGIN}/?sessionId=${encodeURIComponent(sessionId)}`
}

export const VOICE_WORKER_EVENTS = {
  enabled: EVENT_ENABLED,
  status: EVENT_STATUS,
} as const

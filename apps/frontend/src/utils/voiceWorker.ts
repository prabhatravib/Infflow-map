const VOICE_WORKER_ORIGIN = 'https://hexa-worker.prabhatravib.workers.dev'
const SESSION_STORAGE_KEY = 'voiceWorkerSessionId'
const PLAN_HASH_KEY = 'voiceWorkerLastTripPlanHash'
const STATUS_STORAGE_KEY = 'voiceWorkerTripPlanStatus'
const LAST_TRIP_STORAGE_KEY = 'currentItinerary'

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

const persistedStatus = (() => {
  const storage = getSessionStorage()
  const saved = storage?.getItem(STATUS_STORAGE_KEY)
  if (saved === 'sent' || saved === 'not-sent') {
    return saved as TripPlanStatus
  }
  return null
})()

if (persistedStatus) {
  tripPlanStatus = persistedStatus
}

function setGlobalSessionId(sessionId: string | null) {
  if (typeof window === 'undefined') return
  if (sessionId) {
    ;(window as any).voiceWorkerSessionId = sessionId
  } else {
    delete (window as any).voiceWorkerSessionId
  }
}

function tryGetStoredTripPlan(): unknown | null {
  const storage = getSessionStorage()
  const raw = storage?.getItem(LAST_TRIP_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch (error) {
    console.warn('[VoiceWorker] Failed to parse stored trip plan:', error)
    return null
  }
}

interface StoredPlanMeta {
  hash: string
  sessionId: string
}

function getStoredPlanMeta(storage = getSessionStorage()): StoredPlanMeta | null {
  const raw = storage?.getItem(PLAN_HASH_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.hash === 'string' && typeof parsed.sessionId === 'string') {
      return { hash: parsed.hash, sessionId: parsed.sessionId }
    }
    if (parsed && typeof parsed === 'string') {
      return { hash: parsed, sessionId: '' }
    }
  } catch (error) {
    if (typeof raw === 'string') {
      return { hash: raw, sessionId: '' }
    }
    console.warn('[VoiceWorker] Failed to parse stored plan meta:', error)
  }

  if (typeof raw === 'string') {
    return { hash: raw, sessionId: '' }
  }

  return null
}

function setStoredPlanMeta(meta: StoredPlanMeta, storage = getSessionStorage()) {
  try {
    storage?.setItem(PLAN_HASH_KEY, JSON.stringify(meta))
  } catch (error) {
    console.warn('[VoiceWorker] Failed to persist plan meta:', error)
  }
}

function hasStoredPlan(): boolean {
  return Boolean(getStoredPlanMeta())
}

function ensureSessionId(): string {
  if (currentSessionId) {
    return currentSessionId
  }

  const storage = getSessionStorage()
  const stored = storage?.getItem(SESSION_STORAGE_KEY)

  if (stored) {
    currentSessionId = stored
    setGlobalSessionId(stored)
    return stored
  }

  const newSessionId = generateSessionId()
  currentSessionId = newSessionId
  setGlobalSessionId(newSessionId)
  storage?.setItem(SESSION_STORAGE_KEY, newSessionId)
  return newSessionId
}

function dispatchVoiceWorkerEvent<T>(name: string, detail: T) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

function clearPlanHash(storage = getSessionStorage()) {
  storage?.removeItem(PLAN_HASH_KEY)
}

function persistTripStatus(status: TripPlanStatus) {
  const storage = getSessionStorage()
  if (!storage) return
  try {
    storage.setItem(STATUS_STORAGE_KEY, status)
  } catch (error) {
    console.warn('[VoiceWorker] Failed to persist trip status:', error)
  }
}

function setTripPlanStatus(status: TripPlanStatus) {
  tripPlanStatus = status
  persistTripStatus(status)
  if (status === 'not-sent') {
    clearPlanHash()
  }
  dispatchVoiceWorkerEvent<VoiceWorkerStatusDetail>(EVENT_STATUS, { status })
}

export function getTripPlanStatus(): TripPlanStatus {
  if (tripPlanStatus === 'sent') {
    return 'sent'
  }

  if (hasStoredPlan()) {
    tripPlanStatus = 'sent'
    return 'sent'
  }

  return 'not-sent'
}

export function isVoiceWorkerEnabled(): boolean {
  return voiceEnabled
}

export async function enableVoiceWorker(): Promise<string> {
  const storage = getSessionStorage()
  const newSessionId = generateSessionId()

  voiceEnabled = true
  currentSessionId = newSessionId
  setGlobalSessionId(newSessionId)
  storage?.setItem(SESSION_STORAGE_KEY, newSessionId)

  const persistedMeta = getStoredPlanMeta(storage)

  dispatchVoiceWorkerEvent<VoiceWorkerEnabledDetail>(EVENT_ENABLED, {
    enabled: true,
    sessionId: newSessionId,
  })

  if (persistedMeta?.hash) {
    setTripPlanStatus('sent')
    const storedPlan = tryGetStoredTripPlan()
    if (storedPlan) {
      await sendTripPlanToVoiceWorker(storedPlan, { force: persistedMeta.sessionId !== newSessionId })
    }
  } else {
    setTripPlanStatus('not-sent')
  }

  return newSessionId
}

export function disableVoiceWorker(): void {
  const storage = getSessionStorage()

  voiceEnabled = false
  currentSessionId = null
  setGlobalSessionId(null)
  storage?.removeItem(SESSION_STORAGE_KEY)

  dispatchVoiceWorkerEvent<VoiceWorkerEnabledDetail>(EVENT_ENABLED, {
    enabled: false,
  })
}

export function markTripPlanPending(): void {}

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
  force?: boolean
}

export async function sendTripPlanToVoiceWorker(
  plan: unknown,
  options: TripPlanPayload = {}
) {
  const serializedPlan = options.textOverride || normalizePlanToText(plan)
  const planHash = getPlanFingerprint(serializedPlan)
  const storage = getSessionStorage()
  const persistedMeta = getStoredPlanMeta(storage)
  const sessionId = ensureSessionId()

  if (!options.force && persistedMeta?.hash === planHash && persistedMeta.sessionId === sessionId) {
    setTripPlanStatus('sent')
    return
  }

  const payload = {
    sessionId,
    type: options.type || 'trip_plan',
    text: serializedPlan,
    prompt: options.prompt || `Trip plan context for session ${sessionId}`,
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

    setStoredPlanMeta({ hash: planHash, sessionId })
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

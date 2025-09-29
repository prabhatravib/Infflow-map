import { useEffect, useRef } from 'react'

export function VoiceInitializer() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    const initializeVoice = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).io) {
          await initializeWebSocketConnection()
        } else {
          setTimeout(initializeVoice, 1000)
        }
      } catch (error) {
        console.error('Failed to initialize voice:', error)
      }
    }

    initializeVoice()
  }, [])

  const initializeWebSocketConnection = async () => {
    try {
      const socket = (window as any).io('/travel/ws', {
        path: '/socket.io/',
        transports: ['polling', 'websocket'],
        timeout: 30000,
        pingTimeout: 60000,
        pingInterval: 25000,
      })

      socket.on('connect', () => {
        console.log('[Voice] Connected to voice service')
        socket.emit('start_session', {})
      })

      socket.on('session_started', (data: any) => {
        console.log('[Voice] Session started:', data)
        socket.emit('map_ready', {})
      })

      socket.on('connected', (data: any) => {
        console.log('[Voice] Assistant connected:', data)
      })

      socket.on('audio_chunk', (data: any) => {
        if (data.audio) {
          playAudioChunk(data.audio)
        }
      })

      socket.on('transcript', (data: any) => {
        if (data.text) {
          const event = new CustomEvent('voiceMessage', {
            detail: { type: 'assistant', content: data.text },
          })
          window.dispatchEvent(event)
        }
      })

      socket.on('error', (error: any) => {
        console.error('[Voice] Service error:', error)
      })

      socket.on('disconnect', (reason: string) => {
        console.log('[Voice] Disconnected from voice service:', reason)
      })

      ;(window as any).voiceSocket = socket
    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error)
    }
  }

  const playAudioChunk = (audioData: string) => {
    try {
      const audioBytes = atob(audioData)
      const audioArray = new Uint8Array(audioBytes.length)
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i)
      }

      const audioBlob = new Blob([audioArray], { type: 'audio/wav' })
      const audioUrl = URL.createObjectURL(audioBlob)

      const audio = new Audio(audioUrl)
      audio.play().catch((error) => {
        console.error('Failed to play audio:', error)
      })

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
      }
    } catch (error) {
      console.error('Failed to play audio chunk:', error)
    }
  }

  return null
}

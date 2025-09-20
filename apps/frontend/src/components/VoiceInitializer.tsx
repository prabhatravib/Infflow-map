import React, { useEffect, useRef } from 'react'

export const VoiceInitializer: React.FC = () => {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Initialize voice functionality
    const initializeVoice = async () => {
      try {
        // Wait for Socket.IO to be available
        if (typeof window !== 'undefined' && (window as any).io) {
          await initializeWebSocketConnection()
        } else {
          // Retry after a short delay
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

      // Connection event handlers
      socket.on('connect', () => {
        console.log('✅ Connected to voice service')
        
        // Start session
        socket.emit('start_session', {})
      })

      socket.on('session_started', (data: any) => {
        console.log('✅ Voice session started:', data)
        
        // Notify map that it's ready
        socket.emit('map_ready', {})
      })

      socket.on('connected', (data: any) => {
        console.log('✅ Voice assistant connected:', data)
      })

      // Audio event handlers
      socket.on('audio_chunk', (data: any) => {
        // Handle incoming audio from assistant
        if (data.audio) {
          playAudioChunk(data.audio)
        }
      })

      socket.on('transcript', (data: any) => {
        // Handle transcript updates
        if (data.text) {
          // Dispatch custom event for chat panel
          const event = new CustomEvent('voiceMessage', {
            detail: { type: 'assistant', content: data.text }
          })
          window.dispatchEvent(event)
        }
      })

      socket.on('error', (error: any) => {
        console.error('❌ Voice service error:', error)
      })

      socket.on('disconnect', (reason: string) => {
        console.log('🔌 Disconnected from voice service:', reason)
      })

      // Store socket globally for other components
      ;(window as any).voiceSocket = socket

    } catch (error) {
      console.error('Failed to initialize WebSocket connection:', error)
    }
  }

  const playAudioChunk = (audioData: string) => {
    try {
      // Convert base64 to audio blob
      const audioBytes = atob(audioData)
      const audioArray = new Uint8Array(audioBytes.length)
      for (let i = 0; i < audioBytes.length; i++) {
        audioArray[i] = audioBytes.charCodeAt(i)
      }
      
      const audioBlob = new Blob([audioArray], { type: 'audio/wav' })
      const audioUrl = URL.createObjectURL(audioBlob)
      
      const audio = new Audio(audioUrl)
      audio.play().catch(error => {
        console.error('Failed to play audio:', error)
      })
      
      // Clean up URL after playing
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
      }
    } catch (error) {
      console.error('Failed to play audio chunk:', error)
    }
  }

  return null // This component doesn't render anything
}

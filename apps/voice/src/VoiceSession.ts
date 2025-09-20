import { OpenAI } from 'openai'

export interface Env {
  OPENAI_API_KEY: string
  ENVIRONMENT: string
}

export class VoiceSession {
  private state: DurableObjectState
  private env: Env
  private openai: OpenAI
  private websocket: WebSocket | null = null
  private sessionId: string
  private isConnected: boolean = false

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.env = env
    this.openai = new OpenAI({ apiKey: env.OPENAI_API_KEY })
    this.sessionId = state.id.toString()
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request)
    }

    // Handle API requests
    if (path.includes('/session/')) {
      return this.handleSessionAPI(request)
    }

    return new Response('Not Found', { status: 404 })
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [client, server] = Object.values(webSocketPair)

    this.websocket = server
    this.isConnected = true

    // Accept the WebSocket connection
    server.accept()

    // Set up event handlers
    server.addEventListener('message', (event) => {
      this.handleWebSocketMessage(event.data)
    })

    server.addEventListener('close', () => {
      this.isConnected = false
      this.websocket = null
    })

    server.addEventListener('error', (error) => {
      console.error('WebSocket error:', error)
      this.isConnected = false
      this.websocket = null
    })

    // Send welcome message
    this.sendToClient({
      type: 'connected',
      sessionId: this.sessionId,
      timestamp: Date.now()
    })

    return new Response(null, {
      status: 101,
      webSocket: client,
    })
  }

  private async handleWebSocketMessage(data: string | ArrayBuffer) {
    try {
      const message = JSON.parse(data as string)
      
      switch (message.type) {
        case 'start_session':
          await this.handleStartSession(message)
          break
        case 'map_ready':
          await this.handleMapReady(message)
          break
        case 'audio_data':
          await this.handleAudioData(message)
          break
        case 'text_message':
          await this.handleTextMessage(message)
          break
        case 'ping':
          this.sendToClient({ type: 'pong', timestamp: Date.now() })
          break
        default:
          console.log('Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
      this.sendToClient({
        type: 'error',
        message: 'Failed to process message'
      })
    }
  }

  private async handleStartSession(message: any) {
    try {
      // Initialize OpenAI Realtime API connection
      const realtimeResponse = await this.openai.beta.realtime.sessions.create({
        model: 'gpt-4o-realtime-preview-2024-10-01',
        voice: 'alloy',
        instructions: `You are a helpful travel planning assistant. Help users plan their trips by providing detailed itineraries, recommendations, and travel advice. Be conversational and friendly.`,
        tools: [
          {
            type: 'function',
            function: {
              name: 'plan_trip',
              description: 'Plan a multi-day itinerary for a city',
              parameters: {
                type: 'object',
                properties: {
                  city: {
                    type: 'string',
                    description: 'The city name for the trip'
                  },
                  days: {
                    type: 'integer',
                    description: 'Number of days for the trip',
                    minimum: 1,
                    maximum: 14
                  }
                },
                required: ['city', 'days']
              }
            }
          }
        ]
      })

      this.sendToClient({
        type: 'session_started',
        sessionId: this.sessionId,
        status: 'active',
        functions_registered: 1,
        timestamp: Date.now()
      })

    } catch (error) {
      console.error('Failed to start session:', error)
      this.sendToClient({
        type: 'error',
        message: 'Failed to start voice session'
      })
    }
  }

  private async handleMapReady(message: any) {
    // Send welcome message when map is ready
    const welcomeMessage = "Hi! I'm ready to help you plan your trip. Just tell me which city you'd like to visit and for how many days."
    
    this.sendToClient({
      type: 'transcript',
      text: welcomeMessage,
      isComplete: true
    })

    // Also send as audio if possible
    try {
      const audioResponse = await this.openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: welcomeMessage
      })

      const audioBuffer = await audioResponse.arrayBuffer()
      const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)))

      this.sendToClient({
        type: 'audio_chunk',
        audio: audioBase64,
        format: 'mp3'
      })
    } catch (error) {
      console.error('Failed to generate audio:', error)
    }
  }

  private async handleAudioData(message: any) {
    // Process incoming audio data
    // This would typically involve sending to OpenAI Realtime API
    console.log('Received audio data:', message.audio?.length, 'bytes')
    
    // For now, just acknowledge receipt
    this.sendToClient({
      type: 'audio_received',
      timestamp: Date.now()
    })
  }

  private async handleTextMessage(message: any) {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful travel planning assistant. Provide concise, helpful responses about travel planning, destinations, and trip advice.'
          },
          {
            role: 'user',
            content: message.text
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      })

      const reply = response.choices[0]?.message?.content || 'I apologize, but I couldn\'t process your request.'

      // Send text response
      this.sendToClient({
        type: 'transcript',
        text: reply,
        isComplete: true
      })

      // Generate audio response
      try {
        const audioResponse = await this.openai.audio.speech.create({
          model: 'tts-1',
          voice: 'alloy',
          input: reply
        })

        const audioBuffer = await audioResponse.arrayBuffer()
        const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)))

        this.sendToClient({
          type: 'audio_chunk',
          audio: audioBase64,
          format: 'mp3'
        })
      } catch (error) {
        console.error('Failed to generate audio response:', error)
      }

    } catch (error) {
      console.error('Failed to process text message:', error)
      this.sendToClient({
        type: 'error',
        message: 'Failed to process your message'
      })
    }
  }

  private sendToClient(message: any) {
    if (this.websocket && this.isConnected) {
      try {
        this.websocket.send(JSON.stringify(message))
      } catch (error) {
        console.error('Failed to send message to client:', error)
        this.isConnected = false
      }
    }
  }

  private async handleSessionAPI(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path.includes('/stats')) {
      return new Response(JSON.stringify({
        sessionId: this.sessionId,
        isConnected: this.isConnected,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response('Not Found', { status: 404 })
  }
}

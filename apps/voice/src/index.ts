import { OpenAI } from 'openai'
import { VoiceSession } from './VoiceSession'

export interface Env {
  OPENAI_API_KEY: string
  ENVIRONMENT: string
  VOICE_SESSION: DurableObjectNamespace
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // WebSocket upgrade
      if (request.headers.get('Upgrade') === 'websocket') {
        return handleWebSocketUpgrade(request, env)
      }

      // API routes
      if (path === '/health') {
        return new Response(JSON.stringify({ 
          status: 'ok', 
          service: 'voice',
          durableObjects: true 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else if (path.startsWith('/session/')) {
        return handleSessionRequest(request, env, corsHeaders)
      } else {
        return new Response('Not Found', { 
          status: 404, 
          headers: corsHeaders 
        })
      }
    } catch (error) {
      console.error('Voice service error:', error)
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
  }
}

async function handleWebSocketUpgrade(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const sessionId = url.searchParams.get('sessionId') || 'default'
  
  // Get or create Durable Object instance
  const durableObjectId = env.VOICE_SESSION.idFromName(sessionId)
  const durableObject = env.VOICE_SESSION.get(durableObjectId)
  
  // Forward the WebSocket upgrade request to the Durable Object
  return durableObject.fetch(request)
}

async function handleSessionRequest(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  const sessionId = pathParts[2] || 'default'
  
  // Get Durable Object instance
  const durableObjectId = env.VOICE_SESSION.idFromName(sessionId)
  const durableObject = env.VOICE_SESSION.get(durableObjectId)
  
  // Forward request to Durable Object
  const modifiedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
  
  const response = await durableObject.fetch(modifiedRequest)
  
  return new Response(response.body, {
    status: response.status,
    headers: { ...corsHeaders, ...Object.fromEntries(response.headers) }
  })
}

export { VoiceSession }

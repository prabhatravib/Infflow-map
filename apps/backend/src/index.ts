import { OpenAI } from 'openai'

export interface Env {
  OPENAI_API_KEY: string
  GOOGLE_MAPS_API_KEY: string
  VOICE_SERVICE_URL: string
  ENVIRONMENT: string
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
      // Route handling
      if (path === '/api/config') {
        return handleConfig(env, corsHeaders)
      } else if (path === '/api/itinerary') {
        return handleItinerary(request, env, corsHeaders)
      } else if (path === '/api/chat') {
        return handleChat(request, env, corsHeaders)
      } else if (path.startsWith('/api/voice/')) {
        return handleVoiceProxy(request, env, corsHeaders)
      } else if (path === '/health') {
        return new Response(JSON.stringify({ status: 'ok', service: 'backend' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } else {
        return new Response('Not Found', { 
          status: 404, 
          headers: corsHeaders 
        })
      }
    } catch (error) {
      console.error('Request error:', error)
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

async function handleConfig(env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(JSON.stringify({
    auth_type: 'api_key',
    google_maps_api_key: env.GOOGLE_MAPS_API_KEY,
    google_maps_client_id: '',
    client_secret_configured: false
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function handleItinerary(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    const body = await request.json()
    const { city, days } = body

    if (!city || !days) {
      return new Response(JSON.stringify({ 
        error: 'Missing required fields: city and days' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Generate itinerary using OpenAI
    const itinerary = await generateItinerary(city, days, env.OPENAI_API_KEY)
    
    return new Response(JSON.stringify(itinerary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Itinerary generation error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to generate itinerary',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleChat(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { 
      status: 405, 
      headers: corsHeaders 
    })
  }

  try {
    const body = await request.json()
    const { text } = body

    if (!text) {
      return new Response(JSON.stringify({ 
        error: 'Missing text field' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process chat message using OpenAI
    const response = await processChatMessage(text, env.OPENAI_API_KEY)
    
    return new Response(JSON.stringify({ reply: response }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('Chat processing error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to process chat message',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function handleVoiceProxy(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Proxy voice-related requests to the voice service
  const voiceServiceUrl = env.VOICE_SERVICE_URL || 'https://infflow-map-voice.prabhatravib.workers.dev'
  
  try {
    const modifiedRequest = new Request(request.url.replace('/api/voice', ''), {
      method: request.method,
      headers: request.headers,
      body: request.body,
    })

    const response = await fetch(voiceServiceUrl + request.url.replace('/api/voice', ''), modifiedRequest)
    
    return new Response(response.body, {
      status: response.status,
      headers: { ...corsHeaders, ...Object.fromEntries(response.headers) }
    })
  } catch (error) {
    console.error('Voice proxy error:', error)
    return new Response(JSON.stringify({ 
      error: 'Voice service unavailable',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

async function generateItinerary(city: string, days: number, apiKey: string): Promise<any> {
  const openai = new OpenAI({ apiKey })

  const prompt = `Create a detailed ${days}-day travel itinerary for ${city}. 
  
  Please provide:
  1. A day-by-day breakdown with specific attractions, restaurants, and activities
  2. Approximate locations with addresses where possible
  3. Time estimates for each activity
  4. Transportation suggestions between locations
  5. Budget-friendly and premium options where applicable
  
  Format the response as a JSON object with the following structure:
  {
    "city": "${city}",
    "days": ${days},
    "itinerary": [
      {
        "day": 1,
        "title": "Day 1 Title",
        "activities": [
          {
            "name": "Activity Name",
            "description": "Detailed description",
            "time": "9:00 AM - 11:00 AM",
            "location": "Address or area",
            "type": "attraction|restaurant|activity|transport",
            "cost": "Free|$|$$|$$$",
            "notes": "Additional tips or information"
          }
        ]
      }
    ],
    "locations": [
      {
        "name": "Location Name",
        "address": "Full address",
        "lat": 48.8566,
        "lng": 2.3522,
        "day": 1,
        "description": "Brief description"
      }
    ],
    "tips": [
      "General travel tips for this city",
      "Cultural considerations",
      "Best times to visit attractions"
    ]
  }`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a professional travel planner with extensive knowledge of cities worldwide. Provide detailed, practical, and accurate travel itineraries.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 4000,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('No response from OpenAI')
    }

    // Try to parse JSON response
    try {
      return JSON.parse(responseText)
    } catch (parseError) {
      // If JSON parsing fails, return a structured response
      return {
        city,
        days,
        itinerary: [
          {
            day: 1,
            title: `Day 1 in ${city}`,
            activities: [
              {
                name: 'Explore the city',
                description: responseText,
                time: 'All day',
                location: city,
                type: 'activity',
                cost: '$$',
                notes: 'AI-generated itinerary'
              }
            ]
          }
        ],
        locations: [
          {
            name: city,
            address: city,
            lat: 0,
            lng: 0,
            day: 1,
            description: 'Main city area'
          }
        ],
        tips: ['Enjoy your trip!']
      }
    }
  } catch (error) {
    console.error('OpenAI API error:', error)
    throw new Error('Failed to generate itinerary with AI')
  }
}

async function processChatMessage(text: string, apiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey })

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful travel assistant. Provide concise, helpful responses about travel planning, destinations, and trip advice.'
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    })

    return completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t process your request.'
  } catch (error) {
    console.error('OpenAI chat error:', error)
    return 'I apologize, but I\'m having trouble processing your request right now. Please try again later.'
  }
}

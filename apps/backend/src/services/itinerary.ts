import { OpenAI } from 'openai'
import { ensureNumber, geocodePlace } from './geocoding'

export interface GenerateItineraryParams {
  city: string
  days: number
  openAIApiKey: string
  googleMapsApiKey: string
}

export interface NormalizedStop {
  name: string
  description?: string
  address?: string
  lat: number
  lng: number
  placeType?: string
  startTime?: string
  endTime?: string
}

export interface NormalizedDay {
  label: string
  stops: NormalizedStop[]
}

export interface NormalizedMetadata {
  city: string
  days: number
  center?: {
    lat: number
    lng: number
  }
}

export interface NormalizedItinerary {
  days: NormalizedDay[]
  metadata: NormalizedMetadata
  tips?: string[]
}

export async function generateItinerary({
  city,
  days,
  openAIApiKey,
  googleMapsApiKey,
}: GenerateItineraryParams): Promise<NormalizedItinerary> {
  if (!openAIApiKey) {
    throw new Error('OPENAI_API_KEY is required')
  }

  const client = new OpenAI({ apiKey: openAIApiKey })

  const completion = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content:
          'You are a professional travel planner with extensive knowledge of cities worldwide. Provide detailed, practical, and accurate travel itineraries.',
      },
      {
        role: 'user',
        content: buildPrompt(city, days),
      },
    ],
    temperature: 0.7,
    max_tokens: 4000,
  })

  const responseText = completion.choices[0]?.message?.content
  if (!responseText) {
    throw new Error('No response from OpenAI')
  }

  let parsed: any
  try {
    parsed = JSON.parse(responseText)
  } catch (error) {
    parsed = {
      city,
      days,
      tips: ['Enjoy your trip!'],
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
            },
          ],
        },
      ],
    }
  }

  return normalizeItineraryResponse(parsed, city, days, googleMapsApiKey)
}

function buildPrompt(city: string, days: number): string {
  return (
    'You are a helpful travel planner. '
    + `Create a ${days}-day itinerary for ${city}. `
    + `All attractions and stops must be located near ${city}. Do not include any stops outside of the country. `
    + 'The schedule must begin at 09:00 local time each day. '
    + 'For every stop, provide a realistic startTime and endTime in 24-hour HH:MM format that reflect typical visit durations. Keep each day in chronological order so every stop starts at or after the previous stop ends, except for the compulsory inclusion of a lunch break. Do not plan for breakfast or dinner. Always account for reasonable travel time between stops (pad 10-45 minutes depending on distance and mode). The trip plan for the day overall should include sensible meal breaks (for example, leave ~12:30-13:30 for lunch when appropriate). '
    + 'Allow occasional evening activities when they make sense for the destination. '
    + 'Reply in strict JSON matching the schema: '
    + '{"days":[{"day":<int>,"stops":[{"name":<str>,"address":<str|null>,"lat":null,"lng":null,"startTime":<"HH:MM">,"endTime":<"HH:MM">}]}]}'
  )
}

async function normalizeItineraryResponse(raw: any, city: string, daysRequested: number, googleMapsApiKey: string): Promise<NormalizedItinerary> {
  const dayMap = new Map<number, NormalizedDay>()
  let firstStop: NormalizedStop | undefined

  const locationBuckets = new Map<number, any[]>()
  if (Array.isArray(raw?.locations)) {
    for (const location of raw.locations) {
      const dayIndex = Math.max(ensureNumber(location?.day, 1) - 1, 0)
      if (!locationBuckets.has(dayIndex)) {
        locationBuckets.set(dayIndex, [])
      }
      locationBuckets.get(dayIndex)!.push(location)
    }
  }

  const buildStop = async (source: any): Promise<NormalizedStop | null> => {
    if (!source) return null

    const latCandidate = source.lat ?? source.latitude
    const lngCandidate = source.lng ?? source.longitude

    let lat = ensureNumber(latCandidate, NaN)
    let lng = ensureNumber(lngCandidate, NaN)

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const query = source.address ?? source.location ?? source.name ?? source.title
      if (typeof query === 'string') {
        const geocoded = await geocodePlace(query, city, googleMapsApiKey)
        if (geocoded) {
          lat = geocoded.lat
          lng = geocoded.lng
        }
      }
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null
    }

    return {
      name: String(source.name ?? source.title ?? source.place ?? 'Unnamed stop'),
      description: source.description ?? source.notes ?? undefined,
      address: source.address ?? source.location ?? undefined,
      lat,
      lng,
      placeType: source.type ?? source.category ?? source.placeType ?? undefined,
      startTime: source.startTime ?? source.start_time ?? undefined,
      endTime: source.endTime ?? source.end_time ?? undefined,
    }
  }

  const setDayStops = (dayIndex: number, label: string | undefined, stops: NormalizedStop[]) => {
    if (!dayMap.has(dayIndex)) {
      dayMap.set(dayIndex, {
        label: label ?? `Day ${dayIndex + 1}`,
        stops: [],
      })
    }
    const day = dayMap.get(dayIndex)!
    if (label && (!day.label || day.label.startsWith('Day '))) {
      day.label = label
    }
    if (stops.length > 0) {
      day.stops = stops
      if (!firstStop) {
        firstStop = stops[0]
      }
    }
  }

  const populateFromList = async (entries: any[], defaultIndexFn: (entry: any, position: number) => number) => {
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]
      const dayIndex = defaultIndexFn(entry, i)
      const sourceStops = Array.isArray(entry?.stops) ? entry.stops : entry?.activities
      let stops: NormalizedStop[] = []

      if (Array.isArray(sourceStops)) {
        const built: NormalizedStop[] = []
        for (const stop of sourceStops) {
          const normalized = await buildStop(stop)
          if (normalized) {
            built.push(normalized)
          }
        }
        stops = built
      }

      if (stops.length === 0 && locationBuckets.has(dayIndex)) {
        const locations = locationBuckets.get(dayIndex)!
        const built: NormalizedStop[] = []
        for (const location of locations) {
          const normalized = await buildStop(location)
          if (normalized) {
            built.push(normalized)
          }
        }
        stops = built
        locationBuckets.delete(dayIndex)
      }

      setDayStops(dayIndex, entry?.label ?? (entry?.title ?? undefined), stops)
    }
  }

  if (Array.isArray(raw?.days) && raw.days.length > 0) {
    await populateFromList(raw.days, (entry, position) => Math.max(ensureNumber(entry?.day, position + 1) - 1, 0))
  }

  if ((dayMap.size === 0 || Array.from(dayMap.values()).some((day) => day.stops.length === 0)) && Array.isArray(raw?.itinerary)) {
    await populateFromList(raw.itinerary, (entry, position) => Math.max(ensureNumber(entry?.day, position + 1) - 1, 0))
  }

  if (locationBuckets.size > 0) {
    for (const [dayIndex, locations] of locationBuckets.entries()) {
      const built: NormalizedStop[] = []
      for (const location of locations) {
        const normalized = await buildStop(location)
        if (normalized) {
          built.push(normalized)
        }
      }
      setDayStops(dayIndex, undefined, built)
    }
  }

  if (dayMap.size === 0) {
    const fallback = await buildStop({ name: city, address: city })
    if (fallback) {
      setDayStops(0, `Day 1`, [fallback])
    } else {
      setDayStops(0, `Day 1`, [])
    }
  }

  const maxDayIndex = Math.max(...Array.from(dayMap.keys()))
  const normalizedDays: NormalizedDay[] = []
  for (let index = 0; index <= maxDayIndex; index += 1) {
    const day = dayMap.get(index)
    normalizedDays.push(
      day ?? {
        label: `Day ${index + 1}`,
        stops: [],
      }
    )
  }

  const ensuredDays = Math.max(normalizedDays.length, daysRequested, ensureNumber(raw?.metadata?.days ?? raw?.days, 0))
  while (normalizedDays.length < ensuredDays) {
    normalizedDays.push({ label: `Day ${normalizedDays.length + 1}`, stops: [] })
  }

  const metadata: NormalizedMetadata = {
    city,
    days: ensuredDays,
  }

  if (!metadata.center) {
    const rawLat = ensureNumber(raw?.metadata?.city_lat ?? raw?.city_lat ?? raw?.lat, NaN)
    const rawLng = ensureNumber(raw?.metadata?.city_lng ?? raw?.city_lng ?? raw?.lng, NaN)
    if (Number.isFinite(rawLat) && Number.isFinite(rawLng)) {
      metadata.center = { lat: rawLat, lng: rawLng }
    } else if (firstStop) {
      metadata.center = { lat: firstStop.lat, lng: firstStop.lng }
    }
  }

  return {
    days: normalizedDays,
    metadata,
    tips: Array.isArray(raw?.tips) ? raw.tips.map(String) : undefined,
  }
}

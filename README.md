# Infflow-Map

An AI-powered travel planning application with voice interface, real-time audio processing, and interactive mapping capabilities.

## Overview

Infflow-Map combines cutting-edge AI technology with intuitive voice interaction to help you plan and explore travel destinations. The application features an animated hexagon character that serves as your personal travel assistant, capable of understanding voice commands and providing real-time travel recommendations.

## Architecture

The application consists of three main services:

1. **Frontend Service** (`apps/frontend/`) - React + TypeScript + Vite
2. **Backend Service** (`apps/backend/`) - TypeScript + Cloudflare Workers  
3. **Voice Service** (`apps/voice/`) - TypeScript + Cloudflare Durable Objects

## Features

✅ **Voice Interface** - Animated hexagon character with OpenAI Realtime API integration  
✅ **Real-time Audio** - PCM16 audio processing and streaming  
✅ **Travel Planning** - AI-powered itinerary generation  
✅ **Interactive Maps** - Google Maps integration with markers and routes  
✅ **WebSocket Communication** - Real-time bidirectional communication  
✅ **Session Management** - Persistent voice session state  
✅ **Responsive UI** - Modern glass-morphism design  

## Quick Start

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers plan
- OpenAI API key
- Google Maps API key

### 1. Install Dependencies

```bash
# Frontend
cd apps/frontend
npm install

# Backend  
cd apps/backend
npm install

# Voice Service
cd apps/voice
npm install
```

### 2. Configure Environment Variables

Set up secrets in Cloudflare Dashboard or via CLI:

```bash
# Backend service
cd apps/backend
wrangler secret put OPENAI_API_KEY
wrangler secret put GOOGLE_MAPS_API_KEY

# Voice service
cd apps/voice  
wrangler secret put OPENAI_API_KEY
```

### 3. Deploy Services

Deploy in order (voice service first, then backend, then frontend):

```bash
# 1. Deploy Voice Service
cd apps/voice
wrangler deploy

# 2. Deploy Backend Service
cd apps/backend
wrangler secret put VOICE_SERVICE_URL  # Set to voice service URL
wrangler deploy

# 3. Deploy Frontend Service
cd apps/frontend
wrangler deploy
```

### 4. Update Service URLs

After deployment, update the backend service with the voice service URL:

```bash
cd apps/backend
wrangler secret put VOICE_SERVICE_URL
# Enter: https://Infflow-Map-voice.your-subdomain.workers.dev
```

## Development

### Local Development

```bash
# Start all services locally
cd apps/frontend && npm run dev &
cd apps/backend && npm run dev &  
cd apps/voice && npm run dev &
```

### Testing

```bash
# Test frontend
curl http://localhost:3000

# Test backend
curl http://localhost:8787/health

# Test voice service
curl http://localhost:8788/health
```

## Service Details

### Frontend Service (`apps/frontend/`)

- **Technology**: React 18 + TypeScript + Vite
- **Deployment**: Cloudflare Workers
- **Features**: 
  - Voice-enabled hexagon interface
  - Google Maps integration
  - Real-time WebSocket client
  - Responsive design

### Backend Service (`apps/backend/`)

- **Technology**: TypeScript + Cloudflare Workers
- **Features**:
  - OpenAI API integration
  - Travel itinerary generation
  - Google Maps API proxy
  - CORS handling

### Voice Service (`apps/voice/`)

- **Technology**: TypeScript + Cloudflare Durable Objects
- **Features**:
  - WebSocket connection management
  - Real-time audio processing
  - OpenAI Realtime API integration
  - Session state persistence

## API Endpoints

### Backend Service

- `GET /api/config` - Get Google Maps configuration
- `POST /api/itinerary` - Generate travel itinerary
- `POST /api/chat` - Process chat messages
- `GET /health` - Health check

### Voice Service

- `WebSocket /` - Voice communication endpoint
- `GET /session/{id}/stats` - Session statistics
- `GET /health` - Health check

## Performance Features

### Optimized Performance
- **Edge computing** - Cloudflare's global network for low latency
- **Auto-scaling** - Serverless architecture that scales automatically
- **Fast execution** - Native runtime performance

### Cost Efficiency
- **Pay-per-use** - Only pay for actual usage
- **No idle costs** - No running servers when idle
- **Bandwidth optimization** - Edge caching and content delivery

### Developer Experience
- **Modern tooling** - TypeScript, Vite, Wrangler
- **Hot reloading** - Instant development feedback
- **Easy deployment** - Single command deployment

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failed**
   - Check voice service URL in backend configuration
   - Verify Durable Objects are enabled in Cloudflare account

2. **Google Maps Not Loading**
   - Verify API key is set correctly
   - Check domain restrictions in Google Cloud Console

3. **OpenAI API Errors**
   - Verify API key has sufficient credits
   - Check rate limits and usage quotas

### Debug Mode

Enable debug logging:

```bash
# Set environment variable
wrangler secret put DEBUG_MODE
# Enter: true
```

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Cloudflare Workers documentation
3. Check OpenAI API documentation

---

*Infflow-Map provides a seamless, AI-powered travel planning experience with voice interaction and real-time mapping capabilities.*
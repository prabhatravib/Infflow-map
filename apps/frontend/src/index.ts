import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

// Cloudflare Workers types
declare global {
  interface KVNamespace {
    get(key: string): Promise<string | null>
    put(key: string, value: string): Promise<void>
  }
  
  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void
  }
}

export interface Env {
  ASSETS: KVNamespace
  ENVIRONMENT: string
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Handle API routes
      if (request.url.includes('/api/')) {
        // Proxy API requests to backend service
        const backendUrl = 'https://infflow-map-backend.prabhatravib.workers.dev'
        const apiRequest = new Request(
          `${backendUrl}${new URL(request.url).pathname}${new URL(request.url).search}`,
          {
            method: request.method,
            headers: request.headers,
            body: request.body,
          }
        )
        return fetch(apiRequest)
      }

      // Handle static assets
      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil,
        },
        {
          ASSET_NAMESPACE: env.ASSETS,
          ASSET_MANIFEST: {},
        }
      )
    } catch (e) {
      // If the asset is not found, return a 404
      return new Response('Not Found', { status: 404 })
    }
  },
}

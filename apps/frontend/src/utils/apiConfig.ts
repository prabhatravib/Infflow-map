// API configuration utility
export class ApiConfig {
  private static backendUrl = (import.meta as any).env?.PROD 
    ? 'https://infflow-map-backend.prabhatravib.workers.dev'
    : ''

  static getApiUrl(endpoint: string): string {
    if ((import.meta as any).env?.PROD) {
      return `${this.backendUrl}${endpoint}`
    } else {
      // In development, use the Vite proxy
      return endpoint
    }
  }

  static async fetchApi(endpoint: string, options?: RequestInit): Promise<Response> {
    const url = this.getApiUrl(endpoint)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response
  }

  static async fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await this.fetchApi(endpoint, options)
    return response.json()
  }
}

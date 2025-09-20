// Socket.IO loader utility
export class SocketIOLoader {
  private static loaded = false
  private static loading = false
  private static loadPromise: Promise<void> | null = null

  static async load(): Promise<void> {
    if (this.loaded) {
      return Promise.resolve()
    }

    if (this.loading && this.loadPromise) {
      return this.loadPromise
    }

    this.loading = true
    this.loadPromise = this.loadSocketIO()
    
    try {
      await this.loadPromise
      this.loaded = true
      this.loading = false
    } catch (error) {
      this.loading = false
      throw error
    }
  }

  private static async loadSocketIO(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if Socket.IO is already loaded
      if (typeof window !== 'undefined' && (window as any).io) {
        resolve()
        return
      }

      // Create script element
      const script = document.createElement('script')
      script.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js'
      script.async = true
      
      script.onload = () => {
        console.log('[SocketIOLoader] Socket.IO loaded successfully')
        resolve()
      }
      
      script.onerror = () => {
        console.error('[SocketIOLoader] Failed to load Socket.IO')
        reject(new Error('Failed to load Socket.IO'))
      }
      
      document.head.appendChild(script)
    })
  }

  static isLoaded(): boolean {
    return this.loaded
  }

  static isLoading(): boolean {
    return this.loading
  }
}

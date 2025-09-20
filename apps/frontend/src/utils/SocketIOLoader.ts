// Socket.IO loader utility
export class SocketIOLoader {
  private static readonly SOCKET_IO_URL = 'https://cdn.socket.io/4.7.4/socket.io.min.js'
  private static loaded = false
  private static loading = false

  static async load(): Promise<void> {
    // Check if Socket.IO is already available
    if (typeof window !== 'undefined' && (window as any).io) {
      this.loaded = true
      return Promise.resolve()
    }

    if (this.loaded || this.loading) {
      return Promise.resolve()
    }

    // Check if script already exists
    const existingScript = document.querySelector(`script[src="${this.SOCKET_IO_URL}"]`)
    if (existingScript) {
      // Wait for it to load
      const checkLoaded = () => {
        if ((window as any).io) {
          this.loaded = true
          return Promise.resolve()
        } else {
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              checkLoaded().then(resolve)
            }, 100)
          })
        }
      }
      return checkLoaded()
    }

    this.loading = true

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = this.SOCKET_IO_URL
      script.async = true
      
      script.onload = () => {
        console.log('[SocketIOLoader] Socket.IO loaded successfully')
        this.loaded = true
        this.loading = false
        resolve()
      }
      
      script.onerror = () => {
        console.error('[SocketIOLoader] Failed to load Socket.IO')
        this.loading = false
        reject(new Error('Failed to load Socket.IO'))
      }
      
      document.head.appendChild(script)
    })
  }

  static isLoaded(): boolean {
    return this.loaded || (typeof window !== 'undefined' && (window as any).io)
  }

  static isLoading(): boolean {
    return this.loading
  }
}

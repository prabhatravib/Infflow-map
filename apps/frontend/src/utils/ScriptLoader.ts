// Global script loader utility to prevent DOM manipulation conflicts
export class ScriptLoader {
  private static loadedScripts = new Set<string>()
  private static loadingScripts = new Map<string, Promise<void>>()

  static async loadScript(src: string, id?: string): Promise<void> {
    const scriptId = id || src
    
    // Return existing promise if already loading
    if (this.loadingScripts.has(scriptId)) {
      return this.loadingScripts.get(scriptId)!
    }

    // Return immediately if already loaded
    if (this.loadedScripts.has(scriptId)) {
      return Promise.resolve()
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector(`script[src="${src}"]`)
    if (existingScript) {
      this.loadedScripts.add(scriptId)
      return Promise.resolve()
    }

    // Create loading promise
    const loadPromise = this.createScript(src, scriptId)
    this.loadingScripts.set(scriptId, loadPromise)

    try {
      await loadPromise
      this.loadedScripts.add(scriptId)
      this.loadingScripts.delete(scriptId)
    } catch (error) {
      this.loadingScripts.delete(scriptId)
      throw error
    }
  }

  private static createScript(src: string, _scriptId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Double-check if script already exists
      const existingScript = document.querySelector(`script[src="${src}"]`)
      if (existingScript) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.defer = true
      
      script.onload = () => {
        console.log(`[ScriptLoader] Script loaded: ${src}`)
        resolve()
      }
      
      script.onerror = () => {
        console.error(`[ScriptLoader] Failed to load script: ${src}`)
        reject(new Error(`Failed to load script: ${src}`))
      }
      
      // Use a more defensive approach
      try {
        document.head.appendChild(script)
      } catch (error) {
        console.error(`[ScriptLoader] Failed to append script: ${src}`, error)
        reject(error)
      }
    })
  }

  static isLoaded(src: string, id?: string): boolean {
    const scriptId = id || src
    return this.loadedScripts.has(scriptId)
  }

  static isLoading(src: string, id?: string): boolean {
    const scriptId = id || src
    return this.loadingScripts.has(scriptId)
  }
}

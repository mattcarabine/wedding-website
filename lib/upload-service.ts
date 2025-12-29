// Types for our upload system
export interface UploadFile {
  id: string
  originalFile: File // Store the original File object separately
  preview: string
  progress: number
  status: "pending" | "uploading" | "retrying" | "success" | "error"
  error?: string
  retries: number
  // Convenience properties from the original file
  name: string
  size: number
  type: string
  lastModified: number
}

export interface UploadOptions {
  maxRetries?: number
  retryDelay?: number
  maxConcurrent?: number
  onProgress?: (fileId: string, progress: number) => void
  onSuccess?: (fileId: string, response: any) => void
  onError?: (fileId: string, error: Error) => void
  onComplete?: (results: { success: number; failed: number }) => void
}

// Default options
const defaultOptions: Required<UploadOptions> = {
  maxRetries: 3,
  retryDelay: 2000,
  maxConcurrent: 1,
  onProgress: () => {},
  onSuccess: () => {},
  onError: () => {},
  onComplete: () => {},
}

// Class to manage uploads with retry logic and connection awareness
export class UploadManager {
  private queue: UploadFile[] = []
  private activeUploads = 0
  private options: Required<UploadOptions>
  private abortControllers: Map<string, AbortController> = new Map()
  private connectionQuality: "good" | "poor" = "good"

  constructor(options?: UploadOptions) {
    this.options = { ...defaultOptions, ...options }
    this.monitorConnectionQuality()
  }

  // Add files to the upload queue
  addToQueue(files: File[]): UploadFile[] {
    const uploadFiles: UploadFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      originalFile: file, // Store the original File object
      preview: URL.createObjectURL(file),
      progress: 0,
      status: "pending",
      retries: 0,
      // Copy file properties for convenience
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    }))

    this.queue = [...this.queue, ...uploadFiles]
    return uploadFiles
  }

  // Remove a file from the queue
  removeFromQueue(fileId: string): void {
    const file = this.queue.find((f) => f.id === fileId)
    if (file) {
      URL.revokeObjectURL(file.preview)

      // If upload is in progress, abort it
      if (file.status === "uploading" || file.status === "retrying") {
        const controller = this.abortControllers.get(fileId)
        if (controller) {
          controller.abort()
          this.abortControllers.delete(fileId)
          this.activeUploads--
        }
      }
    }

    this.queue = this.queue.filter((f) => f.id !== fileId)
  }

  // Start the upload process
  async startUpload(): Promise<void> {
    if (this.queue.length === 0) return

    // Adjust concurrent uploads based on connection quality
    const maxConcurrent =
      this.connectionQuality === "poor"
        ? Math.max(1, Math.floor(this.options.maxConcurrent / 2))
        : this.options.maxConcurrent

    // Process queue until empty
    while (this.queue.some((file) => file.status === "pending" || file.status === "retrying")) {
      // If we've reached max concurrent uploads, wait
      if (this.activeUploads >= maxConcurrent) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        continue
      }

      // Find next file to upload
      const nextFile = this.queue.find((file) => file.status === "pending" || file.status === "retrying")

      if (nextFile) {
        this.activeUploads++
        this.uploadFile(nextFile).finally(() => {
          this.activeUploads--
        })
      }
    }

    // All uploads completed
    const successCount = this.queue.filter((file) => file.status === "success").length
    const failedCount = this.queue.filter((file) => file.status === "error").length

    this.options.onComplete({
      success: successCount,
      failed: failedCount,
    })
  }

  // Upload a single file with retry logic
  private async uploadFile(file: UploadFile): Promise<void> {
    // Update file status
    this.updateFileStatus(file.id, "uploading")

    try {
      // Create a new AbortController for this upload
      const controller = new AbortController()
      this.abortControllers.set(file.id, controller)

      // Create FormData and append the original File object
      const formData = new FormData()
      formData.append("photos", file.originalFile)

      console.log(`Starting upload for ${file.name} (${file.type}, ${file.size} bytes)`)
      console.log("Original file object:", {
        name: file.originalFile.name,
        type: file.originalFile.type,
        size: file.originalFile.size,
        isFile: file.originalFile instanceof File,
      })

      // Upload with progress tracking
      const response = await this.uploadWithProgress(
        "/api/upload",
        formData,
        (progress) => {
          this.updateFileProgress(file.id, progress)
        },
        controller.signal,
      )

      console.log(`Upload response for ${file.name}:`, response)

      // Check if the response indicates success
      if (response.success === false || response.error) {
        throw new Error(response.error || response.message || "Upload failed")
      }

      // Handle success
      this.updateFileStatus(file.id, "success")
      this.abortControllers.delete(file.id)
      this.options.onSuccess(file.id, response)
    } catch (error) {
      console.error(`Upload error for ${file.name}:`, error)

      // Check if this was an abort
      if (error.name === "AbortError") {
        console.log(`Upload aborted for ${file.name}`)
        return
      }

      // Check if we should retry
      if (file.retries < this.options.maxRetries) {
        const retryDelay = this.options.retryDelay * (file.retries + 1)
        console.log(`Retrying upload for ${file.name} in ${retryDelay}ms (attempt ${file.retries + 1})`)

        this.updateFileStatus(file.id, "retrying", `Retrying... (${file.retries + 1}/${this.options.maxRetries})`)
        this.updateFileRetries(file.id, file.retries + 1)

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      } else {
        // Max retries reached
        this.updateFileStatus(file.id, "error", `Failed after ${this.options.maxRetries} attempts: ${error.message}`)
        this.abortControllers.delete(file.id)
        this.options.onError(file.id, error)
      }
    }
  }

  // Upload with progress tracking
  private async uploadWithProgress(
    url: string,
    formData: FormData,
    onProgress: (progress: number) => void,
    signal: AbortSignal,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          onProgress(progress)
        }
      })

      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response)
          } catch (e) {
            console.error("Failed to parse response:", xhr.responseText)
            reject(new Error("Invalid response format"))
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            reject(new Error(errorResponse.error || `HTTP Error: ${xhr.status}`))
          } catch (e) {
            reject(new Error(`HTTP Error: ${xhr.status} - ${xhr.statusText}`))
          }
        }
      })

      xhr.addEventListener("error", () => {
        reject(new Error("Network Error"))
      })

      xhr.addEventListener("abort", () => {
        reject(new Error("AbortError"))
      })

      xhr.open("POST", url)

      // Add abort handler
      signal.addEventListener("abort", () => {
        xhr.abort()
      })

      xhr.send(formData)
    })
  }

  // Monitor connection quality
  private monitorConnectionQuality(): void {
    if ("connection" in navigator) {
      const connection = (navigator as any).connection

      const updateConnectionQuality = () => {
        if (!connection) return

        // Determine connection quality
        if (
          connection.downlink < 1.5 || // Less than 1.5 Mbps
          connection.rtt > 500 || // Round-trip time > 500ms
          connection.effectiveType === "slow-2g" ||
          connection.effectiveType === "2g"
        ) {
          this.connectionQuality = "poor"
          console.log("Poor connection detected, reducing concurrent uploads")
        } else {
          this.connectionQuality = "good"
        }
      }

      // Initial check
      updateConnectionQuality()

      // Listen for changes
      if (connection.addEventListener) {
        connection.addEventListener("change", updateConnectionQuality)
      }
    } else {
      // Fallback: check response times of a small request
      this.checkResponseTime()
    }
  }

  // Fallback connection quality check
  private async checkResponseTime(): Promise<void> {
    try {
      const start = Date.now()
      await fetch("/api/ping", { method: "HEAD", cache: "no-store" })
      const duration = Date.now() - start

      this.connectionQuality = duration > 300 ? "poor" : "good"

      // Recheck periodically
      setTimeout(() => this.checkResponseTime(), 30000)
    } catch (error) {
      console.error("Error checking connection:", error)
      this.connectionQuality = "poor" // Assume poor on error
      setTimeout(() => this.checkResponseTime(), 10000) // Retry sooner
    }
  }

  // Update file status
  private updateFileStatus(fileId: string, status: UploadFile["status"], error?: string): void {
    this.queue = this.queue.map((file) => {
      if (file.id === fileId) {
        return { ...file, status, error }
      }
      return file
    })
  }

  // Update file progress
  private updateFileProgress(fileId: string, progress: number): void {
    this.queue = this.queue.map((file) => {
      if (file.id === fileId) {
        return { ...file, progress }
      }
      return file
    })
    this.options.onProgress(fileId, progress)
  }

  // Update file retry count
  private updateFileRetries(fileId: string, retries: number): void {
    this.queue = this.queue.map((file) => {
      if (file.id === fileId) {
        return { ...file, retries }
      }
      return file
    })
  }

  // Get current queue
  getQueue(): UploadFile[] {
    return [...this.queue]
  }

  // Clear completed uploads from queue
  clearCompleted(): void {
    const completedFiles = this.queue.filter((file) => file.status === "success")
    completedFiles.forEach((file) => {
      URL.revokeObjectURL(file.preview)
    })

    this.queue = this.queue.filter((file) => file.status !== "success")
  }

  // Cancel all uploads
  cancelAll(): void {
    this.abortControllers.forEach((controller) => {
      controller.abort()
    })

    this.queue.forEach((file) => {
      URL.revokeObjectURL(file.preview)
    })

    this.queue = []
    this.abortControllers.clear()
    this.activeUploads = 0
  }
}

// Create a simple ping endpoint for connection testing
export async function pingServer(): Promise<number> {
  const start = Date.now()
  await fetch("/api/ping", { method: "HEAD", cache: "no-store" })
  return Date.now() - start
}

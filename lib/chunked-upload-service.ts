export interface ChunkUploadOptions {
  chunkSize?: number
  maxRetries?: number
  retryDelay?: number
  maxConcurrentChunks?: number
  onProgress?: (fileId: string, progress: number) => void
  onFileComplete?: (fileId: string, result: any) => void
  onError?: (fileId: string, error: Error) => void
  onAllComplete?: (results: { success: number; failed: number }) => void
  onFileStatusChange?: (fileId: string, status: ChunkedFile["status"], queuePosition?: number) => void
  onChunkStatusChange?: (fileId: string, chunkIndex: number, status: string) => void
  onQueueUpdate?: (queuedFiles: string[]) => void
}

export interface ChunkedFile {
  id: string
  file: File
  preview: string
  name: string
  size: number
  type: string
  totalChunks: number
  uploadedChunks: number
  status: "pending" | "queued" | "uploading" | "paused" | "completed" | "error"
  progress: number
  error?: string
  retries: number
  chunkSize: number
  queuePosition?: number
  chunks: {
    index: number
    status: "pending" | "uploading" | "completed" | "error"
    retries: number
  }[]
}

const defaultOptions: Required<ChunkUploadOptions> = {
  chunkSize: 2 * 1024 * 1024, // 2MB chunks
  maxRetries: 3,
  retryDelay: 2000,
  maxConcurrentChunks: 3,
  onProgress: () => {},
  onFileComplete: () => {},
  onError: () => {},
  onAllComplete: () => {},
  onFileStatusChange: () => {},
  onChunkStatusChange: () => {},
  onQueueUpdate: () => {},
}

export class ChunkedUploadManager {
  private files: ChunkedFile[] = []
  private options: Required<ChunkUploadOptions>
  private activeChunks = 0
  private abortControllers: Map<string, AbortController> = new Map()
  private paused = false
  private activeFileId: string | null = null
  private uploadQueue: string[] = []
  private processingQueue = false

  constructor(options?: ChunkUploadOptions) {
    this.options = { ...defaultOptions, ...options }
  }

  // Add files to the upload queue
  addFiles(files: File[]): ChunkedFile[] {
    const chunkedFiles: ChunkedFile[] = files.map((file) => {
      const chunkSize = this.options.chunkSize
      const totalChunks = Math.ceil(file.size / chunkSize)
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

      // Create chunks array
      const chunks = Array.from({ length: totalChunks }, (_, index) => ({
        index,
        status: "pending" as const,
        retries: 0,
      }))

      // Determine initial status - if there's already an active upload, this file is queued
      const initialStatus = this.activeFileId ? ("queued" as const) : ("pending" as const)

      return {
        id,
        file,
        preview: URL.createObjectURL(file),
        name: file.name,
        size: file.size,
        type: file.type,
        totalChunks,
        uploadedChunks: 0,
        status: initialStatus,
        progress: 0,
        retries: 0,
        chunkSize,
        chunks,
      }
    })

    // Add files to internal array
    this.files = [...this.files, ...chunkedFiles]

    // Update queue positions
    this.updateQueuePositions()

    return chunkedFiles
  }

  // Update queue positions for all files
  private updateQueuePositions(): void {
    // Reset queue
    this.uploadQueue = []

    // First, find all pending files (not completed, not error)
    const pendingFiles = this.files.filter(
      (file) => file.status !== "completed" && file.status !== "error" && file.status !== "uploading",
    )

    // If there's an active file, it's not in the queue
    const queuedFiles = pendingFiles.filter((file) => file.id !== this.activeFileId)

    console.log(`Queue update: ${queuedFiles.length} files in queue, active file: ${this.activeFileId || "none"}`)

    // Set queue positions
    queuedFiles.forEach((file, index) => {
      this.uploadQueue.push(file.id)

      // Update file status to queued if not already
      if (file.status !== "queued") {
        this.updateFileStatus(file.id, "queued", index)
      }

      // Update file with queue position
      this.files = this.files.map((f) => {
        if (f.id === file.id) {
          return { ...f, queuePosition: index }
        }
        return f
      })
    })

    // Notify about queue update
    this.options.onQueueUpdate(this.uploadQueue)

    // If there's no active file and we have files in the queue, start processing
    if (!this.activeFileId && !this.paused && this.uploadQueue.length > 0) {
      console.log("No active file but queue has items - starting queue processing")
      setTimeout(() => this.processQueue(), 0)
    }
  }

  // Remove a file
  removeFile(fileId: string): void {
    const file = this.files.find((f) => f.id === fileId)
    if (file) {
      // Revoke object URL to prevent memory leaks
      URL.revokeObjectURL(file.preview)

      // If this is the active file, abort the upload
      if (fileId === this.activeFileId) {
        this.abortUpload(fileId)
        this.activeFileId = null
      }
    }

    // Remove from files array
    this.files = this.files.filter((f) => f.id !== fileId)

    // Update queue positions
    this.updateQueuePositions()

    // If there's no active file, process the queue
    if (!this.activeFileId && !this.paused) {
      this.processQueue()
    }
  }

  // Abort upload for a file
  abortUpload(fileId: string): void {
    const controller = this.abortControllers.get(fileId)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(fileId)
    }

    // Update file status
    this.updateFileStatus(fileId, "pending")

    // If this was the active file, clear active file
    if (fileId === this.activeFileId) {
      this.activeFileId = null
    }
  }

  // Pause all uploads
  pauseAll(): void {
    this.paused = true

    // Update status of uploading file to paused
    if (this.activeFileId) {
      this.updateFileStatus(this.activeFileId, "paused")
    }
  }

  // Resume all uploads
  resumeAll(): void {
    this.paused = false

    // Update status of paused file to pending
    if (this.activeFileId) {
      const activeFile = this.files.find((f) => f.id === this.activeFileId)
      if (activeFile && activeFile.status === "paused") {
        this.updateFileStatus(this.activeFileId, "pending")
      }
    }

    // Restart upload process
    this.processQueue()
  }

  // Start uploading all files
  startUpload(): void {
    this.paused = false

    // Log current state
    this.logQueueState()

    // Update queue positions to ensure everything is in order
    this.updateQueuePositions()

    // Start processing the queue
    this.processQueue()
  }

  // Process the upload queue
  private async processQueue(): Promise<void> {
    // If already processing queue, paused, or no files to process, return
    if (this.processingQueue || this.paused) {
      return
    }

    // If no files in queue, return
    if (this.uploadQueue.length === 0) {
      console.log("No files in upload queue")
      return
    }

    // Set processing flag
    this.processingQueue = true

    try {
      // If there's already an active file, don't start another
      if (this.activeFileId) {
        console.log(`Already processing file ${this.activeFileId}`)
        return
      }

      // Get the next file from the queue
      const nextFileId = this.uploadQueue[0]
      if (!nextFileId) {
        console.log("No next file ID found in queue")
        return
      }

      console.log(`Starting upload for file ${nextFileId}`)

      // Set as active file
      this.activeFileId = nextFileId

      // Start uploading this file
      await this.uploadFile(nextFileId)

      // File upload completed or failed, remove from queue
      this.uploadQueue.shift()

      // Clear active file ID
      this.activeFileId = null

      // Update queue positions
      this.updateQueuePositions()

      // Process next file in queue (if any)
      console.log(`Finished processing file ${nextFileId}, checking for more files...`)
      setTimeout(() => this.processQueue(), 0)
    } catch (error) {
      console.error("Error processing queue:", error)

      // On error, clear active file and try to continue
      this.activeFileId = null

      // Remove the problematic file from the queue
      if (this.uploadQueue.length > 0) {
        this.uploadQueue.shift()
      }

      // Update queue positions
      this.updateQueuePositions()

      // Try to continue with next file
      setTimeout(() => this.processQueue(), 1000)
    } finally {
      this.processingQueue = false
    }
  }

  // Upload a specific file
  private async uploadFile(fileId: string): Promise<void> {
    const file = this.files.find((f) => f.id === fileId)
    if (!file || file.status === "completed" || file.status === "uploading") return

    // Update file status
    this.updateFileStatus(fileId, "uploading")

    // Create a new AbortController for this upload
    const controller = new AbortController()
    this.abortControllers.set(fileId, controller)

    try {
      // Initialize the upload
      const initResponse = await fetch("/api/chunked-upload/init", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          totalSize: file.size,
          totalChunks: file.totalChunks,
          chunkSize: file.chunkSize,
          uploadId: file.id,
        }),
        signal: controller.signal,
      })

      if (!initResponse.ok) {
        const error = await initResponse.text()
        throw new Error(`Failed to initialize upload: ${error}`)
      }

      // Upload chunks
      await this.uploadChunks(file.id, controller.signal)

      // Complete the upload
      const completeResponse = await fetch("/api/chunked-upload/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uploadId: file.id,
          filename: file.name,
          contentType: file.type,
          totalSize: file.size,
          totalChunks: file.totalChunks,
        }),
        signal: controller.signal,
      })

      if (!completeResponse.ok) {
        const error = await completeResponse.text()
        throw new Error(`Failed to complete upload: ${error}`)
      }

      const result = await completeResponse.json()

      // Update file status
      this.updateFileStatus(fileId, "completed")
      this.abortControllers.delete(fileId)

      // Call completion callback
      this.options.onFileComplete(fileId, result)

      // Check if all files are complete
      this.checkAllComplete()
    } catch (error) {
      // Ignore abort errors
      if (error.name === "AbortError") {
        console.log(`Upload aborted for file ${fileId}`)
        return
      }

      console.error(`Upload error for file ${fileId}:`, error)

      // Update file status
      this.updateFileStatus(fileId, "error", error.message)
      this.abortControllers.delete(fileId)

      // Call error callback
      this.options.onError(fileId, error)

      // Check if all files are complete
      this.checkAllComplete()
    }
  }

  // Upload chunks for a file
  private async uploadChunks(fileId: string, signal: AbortSignal): Promise<void> {
    const file = this.files.find((f) => f.id === fileId)
    if (!file) return

    // Get pending chunks
    const pendingChunks = file.chunks.filter((chunk) => chunk.status !== "completed")

    // Create a queue of chunks to upload
    const chunkQueue = [...pendingChunks]

    // Process chunks with concurrency limit
    const activeChunks = new Set<number>()
    const results = new Array(file.totalChunks).fill(null)

    while (chunkQueue.length > 0 || activeChunks.size > 0) {
      // Skip if we're paused or aborted
      if (this.paused || signal.aborted) return

      // Fill up active chunks
      while (chunkQueue.length > 0 && activeChunks.size < this.options.maxConcurrentChunks) {
        const chunk = chunkQueue.shift()
        if (chunk) {
          activeChunks.add(chunk.index)
          this.uploadChunk(fileId, chunk.index).then(
            () => {
              activeChunks.delete(chunk.index)
              results[chunk.index] = true
            },
            (error) => {
              activeChunks.delete(chunk.index)
              results[chunk.index] = error

              // If we should retry, add back to queue
              const updatedFile = this.files.find((f) => f.id === fileId)
              const updatedChunk = updatedFile?.chunks[chunk.index]

              if (updatedChunk && updatedChunk.retries < this.options.maxRetries) {
                // Increment retry count
                this.updateChunkRetries(fileId, chunk.index, updatedChunk.retries + 1)

                // Add back to queue with delay
                setTimeout(
                  () => {
                    if (!this.paused && !signal.aborted) {
                      chunkQueue.push({
                        ...updatedChunk,
                        retries: updatedChunk.retries + 1,
                      })
                    }
                  },
                  this.options.retryDelay * (updatedChunk.retries + 1),
                )
              }
            },
          )
        }
      }

      // Wait a bit before checking again
      if (activeChunks.size >= this.options.maxConcurrentChunks || chunkQueue.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    // Check if any chunks failed
    const failedChunks = results.filter((r) => r !== true && r !== null)
    if (failedChunks.length > 0) {
      throw new Error(`Failed to upload ${failedChunks.length} chunks`)
    }
  }

  // Upload a single chunk
  private async uploadChunk(fileId: string, chunkIndex: number): Promise<void> {
    const file = this.files.find((f) => f.id === fileId)
    if (!file) throw new Error("File not found")

    // Update chunk status
    this.updateChunkStatus(fileId, chunkIndex, "uploading")

    try {
      // Extract the chunk from the file
      const start = chunkIndex * file.chunkSize
      const end = Math.min(start + file.chunkSize, file.size)
      const chunkBlob = file.file.slice(start, end)

      // Create form data
      const formData = new FormData()
      formData.append("chunk", chunkBlob)
      formData.append("uploadId", file.id)
      formData.append("chunkIndex", chunkIndex.toString())
      formData.append("totalChunks", file.totalChunks.toString())

      // Upload the chunk
      const response = await fetch("/api/chunked-upload/chunk", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Chunk upload failed: ${errorText}`)
      }

      // Update chunk status
      this.updateChunkStatus(fileId, chunkIndex, "completed")

      // Update file progress
      this.updateFileProgress(fileId)

      return await response.json()
    } catch (error) {
      console.error(`Error uploading chunk ${chunkIndex} for file ${fileId}:`, error)
      // Update chunk status
      this.updateChunkStatus(fileId, chunkIndex, "error")

      throw error
    }
  }

  // Update file status
  private updateFileStatus(fileId: string, status: ChunkedFile["status"], queuePosition?: number): void {
    this.files = this.files.map((file) => {
      if (file.id === fileId) {
        const updatedFile = {
          ...file,
          status,
          queuePosition: queuePosition !== undefined ? queuePosition : file.queuePosition,
        }
        // Call the status change callback
        this.options.onFileStatusChange(fileId, status, queuePosition)
        return updatedFile
      }
      return file
    })
  }

  // Update chunk status
  private updateChunkStatus(fileId: string, chunkIndex: number, status: ChunkedFile["chunks"][0]["status"]): void {
    this.files = this.files.map((file) => {
      if (file.id === fileId) {
        const chunks = [...file.chunks]
        chunks[chunkIndex] = { ...chunks[chunkIndex], status }

        // Update uploaded chunks count
        const uploadedChunks = chunks.filter((c) => c.status === "completed").length

        // Call the chunk status change callback
        this.options.onChunkStatusChange(fileId, chunkIndex, status)

        return { ...file, chunks, uploadedChunks }
      }
      return file
    })
  }

  // Update chunk retry count
  private updateChunkRetries(fileId: string, chunkIndex: number, retries: number): void {
    this.files = this.files.map((file) => {
      if (file.id === fileId) {
        const chunks = [...file.chunks]
        chunks[chunkIndex] = { ...chunks[chunkIndex], retries }
        return { ...file, chunks }
      }
      return file
    })
  }

  // Update file progress
  private updateFileProgress(fileId: string): void {
    const file = this.files.find((f) => f.id === fileId)
    if (!file) return

    const completedChunks = file.chunks.filter((chunk) => chunk.status === "completed").length
    const progress = Math.round((completedChunks / file.totalChunks) * 100)

    this.files = this.files.map((f) => {
      if (f.id === fileId) {
        return { ...f, progress, uploadedChunks: completedChunks }
      }
      return f
    })

    // Call progress callback
    this.options.onProgress(fileId, progress)
  }

  // Check if all files are complete
  private checkAllComplete(): void {
    const allFiles = this.files
    const completedFiles = allFiles.filter((file) => file.status === "completed")
    const failedFiles = allFiles.filter((file) => file.status === "error")

    if (completedFiles.length + failedFiles.length === allFiles.length) {
      this.options.onAllComplete({
        success: completedFiles.length,
        failed: failedFiles.length,
      })
    }
  }

  // Get all files
  getFiles(): ChunkedFile[] {
    return [...this.files]
  }

  // Clear completed files
  clearCompleted(): void {
    const completedFiles = this.files.filter((file) => file.status === "completed")
    completedFiles.forEach((file) => {
      URL.revokeObjectURL(file.preview)
    })

    this.files = this.files.filter((file) => file.status !== "completed")

    // Update queue positions
    this.updateQueuePositions()
  }

  // Retry failed files
  retryFailed(): void {
    const failedFiles = this.files.filter((file) => file.status === "error")

    failedFiles.forEach((file) => {
      // Reset file status
      this.updateFileStatus(file.id, "pending")

      // Reset failed chunks
      file.chunks.forEach((chunk, index) => {
        if (chunk.status === "error") {
          this.updateChunkStatus(file.id, index, "pending")
        }
      })
    })

    // Update queue positions
    this.updateQueuePositions()

    // Restart upload process
    this.processQueue()
  }

  // Cancel all uploads
  cancelAll(): void {
    // Abort all active uploads
    this.abortControllers.forEach((controller) => {
      controller.abort()
    })

    // Clear abort controllers
    this.abortControllers.clear()

    // Reset file statuses
    this.files.forEach((file) => {
      if (file.status === "uploading" || file.status === "paused" || file.status === "queued") {
        this.updateFileStatus(file.id, "pending")
      }
    })

    // Clear active file
    this.activeFileId = null

    // Update queue positions
    this.updateQueuePositions()
  }

  // Clean up chunks for a specific upload
  async cleanupUpload(uploadId: string): Promise<void> {
    try {
      console.log(`Cleaning up chunks for upload ${uploadId}`)

      const response = await fetch("/api/chunked-upload/cleanup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uploadId }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Cleanup failed: ${errorText}`)
      }

      const result = await response.json()
      console.log(`Cleanup completed for ${uploadId}:`, result)
    } catch (error) {
      console.error(`Error cleaning up upload ${uploadId}:`, error)
      // Don't throw - cleanup failures shouldn't break the app
    }
  }

  // Remove a file and clean up its chunks
  async removeFileWithCleanup(fileId: string): Promise<void> {
    const file = this.files.find((f) => f.id === fileId)
    if (file) {
      // Revoke object URL to prevent memory leaks
      URL.revokeObjectURL(file.preview)

      // Abort any active uploads for this file
      this.abortUpload(fileId)

      // Clean up chunks if the upload was in progress
      if (file.status === "uploading" || file.status === "paused" || file.uploadedChunks > 0) {
        await this.cleanupUpload(fileId)
      }
    }

    this.files = this.files.filter((f) => f.id !== fileId)

    // Update queue positions
    this.updateQueuePositions()

    // If there's no active file, process the queue
    if (!this.activeFileId && !this.paused) {
      this.processQueue()
    }
  }

  // Cancel all uploads and clean up
  async cancelAllWithCleanup(): Promise<void> {
    // Abort all active uploads
    this.abortControllers.forEach((controller) => {
      controller.abort()
    })

    // Clear abort controllers
    this.abortControllers.clear()

    // Clean up chunks for uploads that were in progress
    const uploadsToCleanup = this.files
      .filter((file) => file.status === "uploading" || file.status === "paused" || file.uploadedChunks > 0)
      .map((file) => file.id)

    // Clean up chunks in parallel
    if (uploadsToCleanup.length > 0) {
      console.log(`Cleaning up ${uploadsToCleanup.length} uploads`)
      await Promise.allSettled(uploadsToCleanup.map((uploadId) => this.cleanupUpload(uploadId)))
    }

    // Reset file statuses
    this.files.forEach((file) => {
      if (file.status === "uploading" || file.status === "paused" || file.status === "queued") {
        this.updateFileStatus(file.id, "pending")
      }
    })

    // Clear active file
    this.activeFileId = null

    // Update queue positions
    this.updateQueuePositions()
  }

  // Debug method to log the current state
  private logQueueState(): void {
    console.log("=== Upload Queue State ===")
    console.log(`Active file: ${this.activeFileId || "none"}`)
    console.log(`Queue length: ${this.uploadQueue.length}`)
    console.log(`Files in queue: ${this.uploadQueue.join(", ")}`)
    console.log(`Processing queue: ${this.processingQueue}`)
    console.log(`Paused: ${this.paused}`)
    console.log("Files status:")
    this.files.forEach((file) => {
      console.log(`- ${file.id}: ${file.status} (${file.name})`)
    })
    console.log("========================")
  }
}

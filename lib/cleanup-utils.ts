// Utility functions for managing blob storage cleanup

export async function cleanupOrphanedChunks(): Promise<{
  success: boolean
  deletedCount: number
  failedCount: number
  error?: string
}> {
  try {
    const response = await fetch("/api/chunked-upload/cleanup-orphaned", {
      method: "POST",
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Cleanup failed: ${errorText}`)
    }

    const result = await response.json()
    return {
      success: true,
      deletedCount: result.deletedCount,
      failedCount: result.failedCount,
    }
  } catch (error) {
    console.error("Error cleaning up orphaned chunks:", error)
    return {
      success: false,
      deletedCount: 0,
      failedCount: 0,
      error: error.message,
    }
  }
}

export async function cleanupSpecificUpload(uploadId: string): Promise<{
  success: boolean
  deletedCount: number
  failedCount: number
  error?: string
}> {
  try {
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
    return {
      success: true,
      deletedCount: result.deletedCount,
      failedCount: result.failedCount,
    }
  } catch (error) {
    console.error(`Error cleaning up upload ${uploadId}:`, error)
    return {
      success: false,
      deletedCount: 0,
      failedCount: 0,
      error: error.message,
    }
  }
}

// Get storage usage statistics
export async function getStorageStats(): Promise<{
  totalChunks: number
  totalSize: number
  uploadGroups: number
  oldestChunk?: Date
}> {
  try {
    // This would require a new API endpoint to get blob statistics
    // For now, return placeholder data
    return {
      totalChunks: 0,
      totalSize: 0,
      uploadGroups: 0,
    }
  } catch (error) {
    console.error("Error getting storage stats:", error)
    throw error
  }
}

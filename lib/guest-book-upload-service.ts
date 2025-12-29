import { ChunkedUploadManager } from "./chunked-upload-service"
import { generateGuestBookImage } from "./client-image-generator"

interface GuestBookEntry {
  guestName: string
  message: string
}

export async function createAndUploadGuestBookImage(entry: GuestBookEntry): Promise<{
  success: boolean
  mediaItemId?: string
  error?: string
}> {
  try {
    console.log("Starting guest book image creation and upload")

    // Generate the image client-side
    const imageBlob = await generateGuestBookImage(entry.message, entry.guestName)

    // Create a File object from the Blob
    const sanitizedName = entry.guestName.replace(/[^\w\s.-]/g, "_")
    const filename = `guest-book-${sanitizedName}-${Date.now()}.png`
    const imageFile = new File([imageBlob], filename, { type: "image/png" })

    // Create upload manager
    const uploadManager = new ChunkedUploadManager({
      maxRetries: 3,
      retryDelay: 2000,
      maxConcurrentChunks: 3,
    })

    // Add file to upload manager
    const [chunkedFile] = uploadManager.addFiles([imageFile])

    // Return promise that resolves when upload completes
    return new Promise((resolve, reject) => {
      // Set up completion handler
      uploadManager.options.onFileComplete = (fileId, result) => {
        if (result.success && result.mediaItemId) {
          resolve({
            success: true,
            mediaItemId: result.mediaItemId,
          })
        } else {
          reject(new Error("Upload completed but no media ID returned"))
        }
      }

      // Set up error handler
      uploadManager.options.onError = (fileId, error) => {
        reject(error)
      }

      // Start upload
      uploadManager.startUpload()
    })
  } catch (error) {
    console.error("Error in guest book image creation and upload:", error)
    return {
      success: false,
      error: error.message || "Failed to create and upload guest book image",
    }
  }
}

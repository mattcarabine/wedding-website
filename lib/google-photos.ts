import { google } from "googleapis"

// Define the photo type
export interface PhotoType {
  id: string
  baseUrl: string
  filename?: string
  creationTime: string
  mimeType: string
}

// Rate limiting configuration
const RATE_LIMITS = {
  maxConcurrent: 2, // Maximum concurrent requests to Google Photos API
  requestDelay: 50, // Minimum delay between requests in ms
  retryDelay: 2000, // Base delay for retries in ms
  maxRetries: 3, // Maximum number of retries for rate limit errors
}

// Auth client caching
interface CachedToken {
  token: string
  expiresAt: number
}

// Cache for auth client and token
let cachedAuthClient: any = null
let cachedToken: CachedToken | null = null
const AUTH_CACHE_TTL = 30 * 1000 // 30 seconds in milliseconds

// Semaphore for controlling concurrent requests
class Semaphore {
  private permits: number
  private waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return Promise.resolve()
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()!
      resolve()
    } else {
      this.permits++
    }
  }
}

// Create a semaphore for Google Photos API requests
const photosSemaphore = new Semaphore(RATE_LIMITS.maxConcurrent)

// Initialize the Google Photos API client with caching
async function getAuthClient() {
  const now = Date.now()

  try {
    // If we have a cached client and it's still valid, return it
    if (cachedAuthClient && cachedToken && cachedToken.expiresAt > now) {
      console.log("Using cached auth client and token")
      return { client: cachedAuthClient, token: cachedToken.token }
    }

    console.log("Creating new auth client or refreshing token")

    const credentials = {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    }

    // Reuse the cached client if available
    if (!cachedAuthClient) {
      cachedAuthClient = new google.auth.OAuth2(credentials.client_id, credentials.client_secret)
      cachedAuthClient.setCredentials({
        refresh_token: credentials.refresh_token,
      })
    }

    // Get a fresh token
    const tokenResponse = await cachedAuthClient.getAccessToken()
    const accessToken = tokenResponse.token

    // Cache the token with expiration
    cachedToken = {
      token: accessToken,
      expiresAt: now + AUTH_CACHE_TTL,
    }

    return { client: cachedAuthClient, token: accessToken }
  } catch (error) {
    console.error("Error initializing auth client:", error)
    // Clear cache on error
    cachedAuthClient = null
    cachedToken = null
    throw new Error("Failed to initialize Google auth client")
  }
}

// Helper function to add delay
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Upload a photo to Google Photos with rate limiting
export async function uploadToGooglePhotos(
  fileBuffer: Uint8Array,
  filename: string,
  mimeType: string,
): Promise<string> {
  try {
    console.log(`Uploading to Google Photos: ${filename} (${mimeType}, size: ${fileBuffer.length} bytes)`)

    // Acquire semaphore permit (wait if too many concurrent requests)
    await photosSemaphore.acquire()
    console.log(`Acquired permit for ${filename}`)

    try {
      // Add minimum delay between requests
      await delay(RATE_LIMITS.requestDelay)

      const { token: accessToken } = await getAuthClient()
      console.log(`Access token obtained for ${filename}`)

      // 1. Get an upload token with retry logic
      let uploadToken: string | null = null
      let retries = 0

      while (uploadToken === null && retries <= RATE_LIMITS.maxRetries) {
        try {
          console.log(`Getting upload token for ${filename} (attempt ${retries + 1})`)
          uploadToken = await getUploadToken(accessToken, fileBuffer, mimeType)
          console.log(`Upload token obtained for ${filename}`)
        } catch (error) {
          if (error.message?.includes("429") || error.status === 429) {
            retries++
            if (retries <= RATE_LIMITS.maxRetries) {
              const backoffDelay = RATE_LIMITS.retryDelay * Math.pow(2, retries - 1)
              console.log(`Rate limited, retrying in ${backoffDelay}ms (attempt ${retries}/${RATE_LIMITS.maxRetries})`)
              await delay(backoffDelay)
            } else {
              throw new Error(`Rate limit exceeded after ${RATE_LIMITS.maxRetries} retries`)
            }
          } else {
            throw error
          }
        }
      }

      if (!uploadToken) {
        throw new Error("Failed to obtain upload token")
      }

      // 2. Create a media item with the upload token with retry logic
      const albumId = process.env.GOOGLE_PHOTOS_ALBUM_ID
      console.log(`Creating media item in album for ${filename}:`, albumId)

      retries = 0
      let mediaItemId: string | null = null

      while (mediaItemId === null && retries <= RATE_LIMITS.maxRetries) {
        try {
          const createResponse = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              albumId,
              newMediaItems: [
                {
                  simpleMediaItem: {
                    fileName: filename,
                    uploadToken,
                  },
                },
              ],
            }),
          })

          if (!createResponse.ok) {
            const errorText = await createResponse.text()
            console.error(`Media item creation failed for ${filename}:`, createResponse.status, errorText)

            // Check for rate limiting
            if (createResponse.status === 429) {
              retries++
              if (retries <= RATE_LIMITS.maxRetries) {
                const backoffDelay = RATE_LIMITS.retryDelay * Math.pow(2, retries - 1)
                console.log(
                  `Rate limited, retrying in ${backoffDelay}ms (attempt ${retries}/${RATE_LIMITS.maxRetries})`,
                )
                await delay(backoffDelay)
                continue
              }
            }

            throw new Error(`Failed to create media item: ${createResponse.status} ${errorText}`)
          }

          const createData = await createResponse.json()
          console.log(`Media item creation response for ${filename}:`, JSON.stringify(createData))

          const mediaItem = createData.newMediaItemResults?.[0]?.mediaItem
          const status = createData.newMediaItemResults?.[0]?.status

          if (status?.code && status.code !== 0) {
            console.error(`Media item creation status error for ${filename}:`, status)
            throw new Error(`Failed to create media item: ${status.message}`)
          }

          if (!mediaItem || !mediaItem.id) {
            console.error(`No media item returned for ${filename}`)
            throw new Error("Failed to create media item: No media item returned")
          }

          mediaItemId = mediaItem.id
        } catch (error) {
          if (error.message?.includes("429") || error.status === 429) {
            retries++
            if (retries <= RATE_LIMITS.maxRetries) {
              const backoffDelay = RATE_LIMITS.retryDelay * Math.pow(2, retries - 1)
              console.log(`Rate limited, retrying in ${backoffDelay}ms (attempt ${retries}/${RATE_LIMITS.maxRetries})`)
              await delay(backoffDelay)
            } else {
              throw new Error(`Rate limit exceeded after ${RATE_LIMITS.maxRetries} retries`)
            }
          } else {
            throw error
          }
        }
      }

      if (!mediaItemId) {
        throw new Error("Failed to create media item after retries")
      }

      console.log(`Media item created successfully for ${filename}:`, mediaItemId)
      return mediaItemId
    } finally {
      // Always release the semaphore permit
      photosSemaphore.release()
      console.log(`Released permit for ${filename}`)
    }
  } catch (error) {
    console.error(`Error uploading to Google Photos for ${filename}:`, error)
    throw new Error(`Failed to upload to Google Photos: ${error.message}`)
  }
}

// Helper function to get an upload token with better error handling
async function getUploadToken(accessToken: string, fileBuffer: Uint8Array, mimeType: string): Promise<string> {
  try {
    console.log(`Getting upload token for file of type ${mimeType}, size: ${fileBuffer.length} bytes`)

    // Use X-Goog-Upload-Protocol: raw to preserve EXIF data
    const response = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/octet-stream",
        "X-Goog-Upload-Content-Type": mimeType,
        "X-Goog-Upload-Protocol": "raw",
      },
      body: fileBuffer, // Send the entire buffer to preserve EXIF data
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Upload token request failed:", response.status, errorText)

      // Create an error with status code for rate limit detection
      const error = new Error(`Failed to get upload token: ${response.status} ${errorText}`)
      error.status = response.status
      throw error
    }

    const token = await response.text()
    console.log("Upload token obtained, length:", token.length)
    return token
  } catch (error) {
    console.error("Error getting upload token:", error)
    throw error
  }
}

// Helper function to fetch a single page of photos
async function fetchPhotoPage(accessToken: string, albumId: string, pageToken?: string): Promise<any> {

  try {

    const response = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        albumId,
        pageSize: 100, // Maximum allowed by the API
        orderBy: "MediaMetadata.creation_time desc", // Most recent first
        ...(pageToken ? { pageToken } : {}),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch photos: ${response.status} ${errorText}`)
    }

    return response.json()
  } finally {

  }
}

// Get all photos from the album with pagination and rate limiting
export async function getPhotos(): Promise<PhotoType[]> {
  try {
    console.log("Starting to fetch photos with pagination")

    // Get cached auth client and token
    const { token: accessToken } = await getAuthClient()
    const albumId = process.env.GOOGLE_PHOTOS_ALBUM_ID

    // Array to hold all media items
    let allMediaItems: any[] = []
    // Token for the next page
    let nextPageToken: string | undefined = undefined
    // Counter for logging
    let pageCount = 0

    // Loop until we've fetched all pages
    do {
      pageCount++
      console.log(`Fetching page ${pageCount}${nextPageToken ? " with token" : ""}`)

      // Fetch the current page with rate limiting
      let retries = 0
      let data = null

      while (data === null && retries <= RATE_LIMITS.maxRetries) {
        try {
          data = await fetchPhotoPage(accessToken, albumId!, nextPageToken)
        } catch (error) {
          if (error.message?.includes("429") || error.status === 429) {
            retries++
            if (retries <= RATE_LIMITS.maxRetries) {
              const backoffDelay = RATE_LIMITS.retryDelay * Math.pow(2, retries - 1)
              console.log(`Rate limited, retrying in ${backoffDelay}ms (attempt ${retries}/${RATE_LIMITS.maxRetries})`)
              await delay(backoffDelay)
            } else {
              throw new Error(`Rate limit exceeded after ${RATE_LIMITS.maxRetries} retries`)
            }
          } else {
            throw error
          }
        }
      }

      if (!data) {
        throw new Error("Failed to fetch photos after retries")
      }

      // Get media items from this page
      const mediaItems = data.mediaItems || []
      console.log(`Received ${mediaItems.length} items on page ${pageCount}`)

      // Add to our collection
      allMediaItems = [...allMediaItems, ...mediaItems]

      // Get the next page token
      nextPageToken = data.nextPageToken

      // If we have a next page token, add a delay before the next request
      if (nextPageToken) {
        await delay(RATE_LIMITS.requestDelay)
      }
    } while (nextPageToken)

    console.log(`Fetched a total of ${allMediaItems.length} photos across ${pageCount} pages`)

    // Sort all items by creation time descending to ensure most recent first
    const sortedItems = allMediaItems.sort((a, b) => {
      const timeA = new Date(a.mediaMetadata?.creationTime || 0).getTime()
      const timeB = new Date(b.mediaMetadata?.creationTime || 0).getTime()
      return timeB - timeA // Most recent first
    })

    return sortedItems.map((item) => ({
      id: item.id,
      // Ensure we have a valid baseUrl with proper parameters
      baseUrl: item.baseUrl ? `${item.baseUrl}=w800-h800` : "/placeholder.svg",
      filename: item.filename,
      creationTime: item.mediaMetadata?.creationTime || "",
      mimeType: item.mimeType || "image/jpeg",
    }))
  } catch (error) {
    console.error("Error fetching photos:", error)
    return [] // Return empty array instead of failing
  }
}

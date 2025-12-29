import { type NextRequest, NextResponse } from "next/server"
import { uploadToGooglePhotos } from "@/lib/google-photos"

export async function POST(request: NextRequest) {
  console.log("Upload API: Starting upload request")

  try {
    const formData = await request.formData()
    console.log("Upload API: FormData received")

    const photos = formData.getAll("photos") as File[]
    console.log(`Upload API: Found ${photos.length} photos in FormData`)

    if (!photos || photos.length === 0) {
      console.error("Upload API: No photos provided")
      return NextResponse.json(
        {
          success: false,
          error: "No photos provided",
        },
        { status: 400 },
      )
    }

    // Validate that we have actual File objects
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      console.log(`Upload API: Photo ${i + 1}:`, {
        name: photo?.name,
        type: photo?.type,
        size: photo?.size,
        isFile: photo instanceof File,
        hasArrayBuffer: typeof photo?.arrayBuffer === "function",
      })

      if (!photo || typeof photo.arrayBuffer !== "function") {
        console.error(`Upload API: Invalid file object at index ${i}:`, photo)
        return NextResponse.json(
          {
            success: false,
            error: `Invalid file object at position ${i + 1}. Expected File object but received: ${typeof photo}`,
          },
          { status: 400 },
        )
      }

      if (!photo.name || !photo.type || photo.size === 0) {
        console.error(`Upload API: File missing required properties at index ${i}:`, {
          name: photo.name,
          type: photo.type,
          size: photo.size,
        })
        return NextResponse.json(
          {
            success: false,
            error: `File at position ${i + 1} is missing required properties (name, type, or has zero size)`,
          },
          { status: 400 },
        )
      }

      // Validate file size (max 20MB)
      const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB
      if (photo.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `File ${photo.name} exceeds maximum size of 20MB`,
          },
          { status: 400 },
        )
      }

      // Validate file type
      if (!photo.type.startsWith("image/")) {
        return NextResponse.json(
          {
            success: false,
            error: `File ${photo.name} is not a valid image type`,
          },
          { status: 400 },
        )
      }
    }

    console.log("Upload API: All files validated, starting uploads")

    // Upload each photo to Google Photos
    const uploadResults = []

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]
      console.log(`Upload API: Processing photo ${i + 1}/${photos.length}: ${photo.name}`)

      try {
        console.log(`Upload API: Converting ${photo.name} to buffer...`)
        const buffer = await photo.arrayBuffer()
        console.log(`Upload API: Buffer created for ${photo.name}, size: ${buffer.byteLength} bytes`)

        // Ensure we have a valid filename
        const filename = photo.name || `photo-${Date.now()}-${i}.jpg`

        // Ensure we have a valid mime type
        const mimeType = photo.type || "image/jpeg"

        console.log(`Upload API: Uploading ${filename} to Google Photos...`)
        const result = await uploadToGooglePhotos(new Uint8Array(buffer), filename, mimeType)
        console.log(`Upload API: Successfully uploaded ${filename}, result:`, result)

        uploadResults.push({
          success: true,
          filename: filename,
          mediaItemId: result,
        })
      } catch (error) {
        console.error(`Upload API: Error uploading photo ${photo.name}:`, error)
        uploadResults.push({
          success: false,
          filename: photo.name || `photo-${i}`,
          error: error.message || "Unknown error occurred",
        })
      }
    }

    // Check results
    const successfulUploads = uploadResults.filter((result) => result.success)
    const failedUploads = uploadResults.filter((result) => !result.success)

    console.log(`Upload API: Upload completed. Success: ${successfulUploads.length}, Failed: ${failedUploads.length}`)

    if (failedUploads.length > 0 && successfulUploads.length === 0) {
      // All uploads failed
      console.error("Upload API: All uploads failed")
      return NextResponse.json(
        {
          success: false,
          error: "All uploads failed",
          details: failedUploads,
        },
        { status: 500 },
      )
    } else if (failedUploads.length > 0) {
      // Partial success
      console.warn("Upload API: Some uploads failed")
      return NextResponse.json(
        {
          success: true,
          message: `${successfulUploads.length} of ${photos.length} photo(s) uploaded successfully`,
          results: uploadResults,
          partialSuccess: true,
        },
        { status: 207 },
      ) // 207 Multi-Status
    } else {
      // All successful
      console.log("Upload API: All uploads successful")
      return NextResponse.json({
        success: true,
        message: `${photos.length} photo(s) uploaded successfully`,
        results: uploadResults,
      })
    }
  } catch (error) {
    console.error("Upload API: Unexpected error:", error)
    return NextResponse.json(
      {
        success: false,
        error: `Failed to process upload: ${error.message}`,
      },
      { status: 500 },
    )
  }
}

// Increase the body size limit for file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: "50mb",
  },
}

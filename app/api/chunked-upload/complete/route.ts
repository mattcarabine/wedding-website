import { NextResponse } from "next/server"
import { list, del } from "@vercel/blob"
import { uploadToGooglePhotos } from "@/lib/google-photos"

export async function POST(request: Request) {
  try {
    const { uploadId, filename, contentType, totalChunks } = await request.json()

    // Validate inputs
    if (!uploadId || !filename || !contentType || !totalChunks) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // List all chunks for this upload
    const { blobs } = await list({ prefix: `uploads/${uploadId}/chunk-` })

    // Verify all chunks are received
    if (blobs.length !== totalChunks) {
      return NextResponse.json(
        {
          error: "Not all chunks received",
          received: blobs.length,
          expected: totalChunks,
        },
        { status: 400 },
      )
    }

    // Sort chunks by index
    const sortedBlobs = blobs.sort((a, b) => {
      const indexA = Number.parseInt(a.pathname.split("chunk-")[1].split(".")[0], 10)
      const indexB = Number.parseInt(b.pathname.split("chunk-")[1].split(".")[0], 10)
      return indexA - indexB
    })

    // Download and combine all chunks
    const buffers: Uint8Array[] = []

    for (const blob of sortedBlobs) {
      // Download chunk
      const chunkResponse = await fetch(blob.url)
      const arrayBuffer = await chunkResponse.arrayBuffer()
      buffers.push(new Uint8Array(arrayBuffer))
    }

    // Combine all chunks
    const totalSize = buffers.reduce((sum, buffer) => sum + buffer.length, 0)
    const combinedBuffer = new Uint8Array(totalSize)

    let offset = 0
    for (const buffer of buffers) {
      combinedBuffer.set(buffer, offset)
      offset += buffer.length
    }

    // Upload to Google Photos
    const sanitizedFilename = filename.replace(/[^\w\s.-]/g, "_")
    const mediaItemId = await uploadToGooglePhotos(combinedBuffer, sanitizedFilename, contentType)

    // Clean up temporary chunks from Vercel Blob after successful upload
    console.log(`Cleaning up ${sortedBlobs.length} temporary chunks for upload ${uploadId}`)

    try {
      // Delete all chunk files
      const deletePromises = sortedBlobs.map(async (blob) => {
        try {
          await del(blob.url)
          console.log(`Deleted chunk: ${blob.pathname}`)
        } catch (deleteError) {
          console.error(`Failed to delete chunk ${blob.pathname}:`, deleteError)
          // Don't fail the entire request if cleanup fails
        }
      })

      // Wait for all deletions to complete
      await Promise.allSettled(deletePromises)
      console.log(`Cleanup completed for upload ${uploadId}`)
    } catch (cleanupError) {
      console.error(`Error during cleanup for upload ${uploadId}:`, cleanupError)
      // Log the error but don't fail the request since the main upload succeeded
    }

    return NextResponse.json({
      success: true,
      mediaItemId,
      filename: sanitizedFilename,
      chunksCleanedUp: sortedBlobs.length,
    })
  } catch (error) {
    console.error("Error completing chunked upload:", error)
    return NextResponse.json({ error: "Failed to complete upload: " + error.message }, { status: 500 })
  }
}

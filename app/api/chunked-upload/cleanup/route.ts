import { NextResponse } from "next/server"
import { list, del } from "@vercel/blob"

export async function POST(request: Request) {
  try {
    const { uploadId } = await request.json()

    if (!uploadId) {
      return NextResponse.json({ error: "Upload ID is required" }, { status: 400 })
    }

    console.log(`Starting cleanup for upload ${uploadId}`)

    // List all chunks for this upload
    const { blobs } = await list({ prefix: `uploads/${uploadId}/` })

    if (blobs.length === 0) {
      console.log(`No chunks found for upload ${uploadId}`)
      return NextResponse.json({
        success: true,
        message: "No chunks to clean up",
        deletedCount: 0,
      })
    }

    console.log(`Found ${blobs.length} chunks to delete for upload ${uploadId}`)

    // Delete all chunks
    const deleteResults = await Promise.allSettled(
      blobs.map(async (blob) => {
        try {
          await del(blob.url)
          console.log(`Deleted: ${blob.pathname}`)
          return { success: true, pathname: blob.pathname }
        } catch (error) {
          console.error(`Failed to delete ${blob.pathname}:`, error)
          return { success: false, pathname: blob.pathname, error: error.message }
        }
      }),
    )

    const successfulDeletes = deleteResults.filter(
      (result) => result.status === "fulfilled" && result.value.success,
    ).length

    const failedDeletes = deleteResults.filter(
      (result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value.success),
    ).length

    console.log(`Cleanup completed for upload ${uploadId}: ${successfulDeletes} deleted, ${failedDeletes} failed`)

    return NextResponse.json({
      success: true,
      deletedCount: successfulDeletes,
      failedCount: failedDeletes,
      totalChunks: blobs.length,
    })
  } catch (error) {
    console.error("Error during cleanup:", error)
    return NextResponse.json({ error: "Failed to cleanup chunks: " + error.message }, { status: 500 })
  }
}

// Also support DELETE method for RESTful API
export async function DELETE(request: Request) {
  return POST(request)
}

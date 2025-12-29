import { NextResponse } from "next/server"
import { list, del } from "@vercel/blob"

export async function POST() {
  try {
    console.log("Starting orphaned chunks cleanup")

    // List all upload directories
    const { blobs } = await list({ prefix: "uploads/" })

    if (blobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No upload chunks found",
        deletedCount: 0,
      })
    }

    // Group blobs by upload ID
    const uploadGroups = new Map<string, typeof blobs>()

    blobs.forEach((blob) => {
      const pathParts = blob.pathname.split("/")
      if (pathParts.length >= 2 && pathParts[0] === "uploads") {
        const uploadId = pathParts[1]
        if (!uploadGroups.has(uploadId)) {
          uploadGroups.set(uploadId, [])
        }
        uploadGroups.get(uploadId)!.push(blob)
      }
    })

    console.log(`Found ${uploadGroups.size} upload groups with chunks`)

    // Define what constitutes an "orphaned" upload (older than 24 hours)
    const ORPHAN_THRESHOLD = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
    const now = Date.now()

    let totalDeleted = 0
    let totalFailed = 0

    // Check each upload group
    for (const [uploadId, uploadBlobs] of uploadGroups) {
      try {
        // Check if any blob in this upload is older than threshold
        const oldestBlob = uploadBlobs.reduce((oldest, current) => {
          const currentTime = new Date(current.uploadedAt).getTime()
          const oldestTime = new Date(oldest.uploadedAt).getTime()
          return currentTime < oldestTime ? current : oldest
        })

        const blobAge = now - new Date(oldestBlob.uploadedAt).getTime()

        if (blobAge > ORPHAN_THRESHOLD) {
          console.log(`Cleaning up orphaned upload ${uploadId} (age: ${Math.round(blobAge / (60 * 60 * 1000))} hours)`)

          // Delete all chunks for this upload
          const deleteResults = await Promise.allSettled(
            uploadBlobs.map(async (blob) => {
              try {
                await del(blob.url)
                console.log(`Deleted orphaned chunk: ${blob.pathname}`)
                return { success: true }
              } catch (error) {
                console.error(`Failed to delete orphaned chunk ${blob.pathname}:`, error)
                return { success: false }
              }
            }),
          )

          const successful = deleteResults.filter(
            (result) => result.status === "fulfilled" && result.value.success,
          ).length

          const failed = deleteResults.filter(
            (result) => result.status === "rejected" || (result.status === "fulfilled" && !result.value.success),
          ).length

          totalDeleted += successful
          totalFailed += failed
        } else {
          console.log(`Keeping recent upload ${uploadId} (age: ${Math.round(blobAge / (60 * 60 * 1000))} hours)`)
        }
      } catch (error) {
        console.error(`Error processing upload group ${uploadId}:`, error)
        totalFailed += uploadBlobs.length
      }
    }

    console.log(`Orphaned cleanup completed: ${totalDeleted} deleted, ${totalFailed} failed`)

    return NextResponse.json({
      success: true,
      deletedCount: totalDeleted,
      failedCount: totalFailed,
      uploadGroupsProcessed: uploadGroups.size,
    })
  } catch (error) {
    console.error("Error during orphaned cleanup:", error)
    return NextResponse.json({ error: "Failed to cleanup orphaned chunks: " + error.message }, { status: 500 })
  }
}

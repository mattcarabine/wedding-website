import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { filename, contentType, totalSize, totalChunks, chunkSize, uploadId } = await request.json()

    // Validate inputs
    if (!filename || !contentType || !totalSize || !totalChunks || !uploadId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // We'll just return success - no need to store metadata in Blob
    return NextResponse.json({
      uploadId,
      status: "initialized",
      filename,
      contentType,
      totalSize,
      totalChunks,
    })
  } catch (error) {
    console.error("Error initializing chunked upload:", error)
    return NextResponse.json({ error: "Failed to initialize upload: " + error.message }, { status: 500 })
  }
}

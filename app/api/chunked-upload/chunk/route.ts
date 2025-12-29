import { NextResponse } from "next/server"
import { put } from "@vercel/blob"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const chunk = formData.get("chunk") as Blob
    const uploadId = formData.get("uploadId") as string
    const chunkIndex = Number.parseInt(formData.get("chunkIndex") as string, 10)
    const totalChunks = Number.parseInt(formData.get("totalChunks") as string, 10)

    // Validate inputs
    if (!chunk || !uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Instead of getting metadata from Blob, we'll use a simpler approach
    // Store chunk in Vercel Blob with a predictable name pattern
    const { url } = await put(`uploads/${uploadId}/chunk-${chunkIndex}.bin`, chunk, {
      access: "public",
    })

    return NextResponse.json({
      chunkIndex,
      status: "received",
      url,
      progress: Math.round(((chunkIndex + 1) / totalChunks) * 100),
    })
  } catch (error) {
    console.error("Error processing chunk:", error)
    return NextResponse.json({ error: "Failed to process chunk: " + error.message }, { status: 500 })
  }
}

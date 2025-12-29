"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { generateGuestBookImage } from "@/lib/client-image-generator"

interface GuestBookPreviewProps {
  message: string
  guestName: string
  show: boolean
}

export function GuestBookPreview({ message, guestName, show }: GuestBookPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentUrlRef = useRef<string | null>(null)

  useEffect(() => {
    // Clear previous timeout to avoid race conditions
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Don't generate preview if not showing or missing required fields
    if (!show || !message.trim() || !guestName.trim()) {
      // Clean up current preview if hiding or fields are empty
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current)
        currentUrlRef.current = null
      }
      setPreviewUrl(null)
      setError(null)
      return
    }

    // Add a delay to avoid generating previews while typing
    timeoutRef.current = setTimeout(async () => {
      try {
        setIsGenerating(true)
        setError(null)

        console.log("Generating preview for:", {
          message: message.substring(0, 50) + "...",
          guestName,
        })

        // Clean up previous URL before generating new one
        if (currentUrlRef.current) {
          URL.revokeObjectURL(currentUrlRef.current)
          currentUrlRef.current = null
        }

        // Generate the image with error handling
        const imageBlob = await generateGuestBookImage(message.trim(), guestName.trim())

        // Verify blob is valid
        if (!imageBlob || imageBlob.size === 0) {
          throw new Error("Generated image is empty")
        }

        // Create object URL for preview
        const url = URL.createObjectURL(imageBlob)
        currentUrlRef.current = url

        // Update state with new preview URL
        setPreviewUrl(url)
        console.log("Preview generated successfully, blob size:", imageBlob.size)
      } catch (err) {
        console.error("Error generating preview:", err)
        setError("Failed to generate preview. Please try again.")
        setPreviewUrl(null)
      } finally {
        setIsGenerating(false)
      }
    }, 1000) // Increased delay to reduce unnecessary generations

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [message, guestName, show]) // Removed previewUrl from dependencies

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current)
        currentUrlRef.current = null
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  if (!show) {
    return null
  }

  return (
    <div className="mt-4 rounded-lg overflow-hidden border border-input">
      {isGenerating ? (
        <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary/60" />
            <p className="text-sm text-muted-foreground">Generating preview...</p>
          </div>
        </div>
      ) : error ? (
        <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-destructive mb-2">{error}</p>
            <button
              onClick={() => {
                setError(null)
                // Trigger regeneration by clearing and setting a small timeout
                setTimeout(() => {
                  if (message.trim() && guestName.trim()) {
                    setIsGenerating(true)
                  }
                }, 100)
              }}
              className="text-xs text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      ) : previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl || "/placeholder.svg"}
            alt="Guest book entry preview"
            className="w-full h-auto"
            onError={() => {
              console.error("Failed to load preview image")
              setError("Failed to load preview image")
            }}
          />
          <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">Preview</div>
        </div>
      ) : (
        <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Enter your message to see a preview</p>
        </div>
      )}
    </div>
  )
}

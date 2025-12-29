"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { ChevronLeft, ChevronRight, Download, Loader2, ZoomIn, ZoomOut } from "lucide-react"
import type { PhotoType } from "@/lib/google-photos"
import { cn } from "@/lib/utils"
import { useMobile } from "@/hooks/use-mobile"
import { Dialog, DialogContent, DialogOverlay, DialogPortal, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface FullScreenPhotoViewerProps {
  photos: PhotoType[]
  initialIndex: number
  onClose: () => void
}

export function FullScreenPhotoViewer({ photos, initialIndex, onClose }: FullScreenPhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isZoomed, setIsZoomed] = useState(false)
  const [imageError, setImageError] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)
  const isMobile = useMobile()

  const currentPhoto = photos[currentIndex]

  // Reset loading and error state when current photo changes
  useEffect(() => {
    setIsLoading(true)
    setImageError(false)
    setIsZoomed(false)
  }, [currentIndex])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Dialog handles Escape key for closing
      if (e.key === "ArrowLeft") {
        goToPrevious()
      } else if (e.key === "ArrowRight") {
        goToNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [currentIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleImageLoad = () => {
    setIsLoading(false)
    setImageError(false)
  }

  const handleImageError = () => {
    setIsLoading(false)
    setImageError(true)
    console.error("Failed to load image:", currentPhoto?.baseUrl)
  }

  const goToNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setCurrentIndex(currentIndex + 1)
    }
  }, [currentIndex, photos.length])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    }
  }, [currentIndex])

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't initiate swipe if zoomed
    if (isZoomed) return
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    // Don't process move if zoomed or no touch start
    if (isZoomed || touchStart === null) return
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    // Don't process swipe if zoomed
    if (isZoomed) return

    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe) {
      goToNext()
    }

    if (isRightSwipe) {
      goToPrevious()
    }

    setTouchStart(null)
    setTouchEnd(null)
  }

  // Toggle zoom on image click
  const toggleZoom = () => {
    setIsZoomed(!isZoomed)
  }

  // Get high-resolution version of the image
  const getHighResUrl = (url: string) => {
    if (!url) return ""
    return url.replace("=w800-h800", "=w2000-h2000")
  }

  // Get display-friendly filename
  const getDisplayFilename = (filename: string | undefined) => {
    if (!filename) return ""
    return filename.length > 30 ? filename.substring(0, 27) + "..." : filename
  }

  if (!currentPhoto) return null

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95" />
        <DialogContent
          className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 border-none bg-transparent"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Header with controls */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-black/50">
            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="text-white bg-black/30 hover:bg-black/50">
                  <ChevronLeft className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogClose>

              <div className="text-white/70 text-sm">
                {currentIndex + 1} / {photos.length}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white bg-black/30 hover:bg-black/50"
                onClick={toggleZoom}
              >
                {isZoomed ? <ZoomOut className="h-5 w-5" /> : <ZoomIn className="h-5 w-5" />}
                <span className="sr-only">{isZoomed ? "Zoom out" : "Zoom in"}</span>
              </Button>

              <a
                href={currentPhoto?.baseUrl}
                download={currentPhoto?.filename || "wedding-photo.jpg"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center h-9 w-9 rounded-full bg-black/30 hover:bg-black/50 text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-5 w-5" />
                <span className="sr-only">Download</span>
              </a>
            </div>
          </div>

          {/* Main image container */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Loading indicator */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="bg-black/40 rounded-full p-3">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              </div>
            )}

            {/* Error message */}
            {imageError && (
              <div className="text-center text-white/70 p-4 z-10">
                <div className="mb-2">Failed to load image</div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setImageError(false)
                    setIsLoading(true)
                    // Force reload the image
                    if (imageRef.current) {
                      const currentSrc = imageRef.current.src
                      imageRef.current.src = ""
                      setTimeout(() => {
                        if (imageRef.current) imageRef.current.src = currentSrc
                      }, 100)
                    }
                  }}
                >
                  Try again
                </Button>
              </div>
            )}

            {/* Image */}
            {!imageError && (
              <div
                className={cn("transition-transform duration-300 ease-in-out", isZoomed ? "scale-150" : "scale-100")}
                style={{ transformOrigin: "center center" }}
              >
                <img
                  ref={imageRef}
                  src={getHighResUrl(currentPhoto?.baseUrl) || "/placeholder.svg"}
                  alt={currentPhoto?.filename || "Photo"}
                  className={cn(
                    "transition-opacity duration-300 max-w-[90vw] max-h-[80vh] object-contain",
                    isLoading ? "opacity-0" : "opacity-100",
                  )}
                  onClick={toggleZoom}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              </div>
            )}

            {/* Navigation buttons */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute left-4 text-white bg-black/30 hover:bg-black/50 rounded-full",
                "disabled:opacity-30 disabled:cursor-not-allowed",
                isZoomed && "opacity-0 pointer-events-none",
              )}
              onClick={goToPrevious}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-6 w-6" />
              <span className="sr-only">Previous</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "absolute right-4 text-white bg-black/30 hover:bg-black/50 rounded-full",
                "disabled:opacity-30 disabled:cursor-not-allowed",
                isZoomed && "opacity-0 pointer-events-none",
              )}
              onClick={goToNext}
              disabled={currentIndex === photos.length - 1}
            >
              <ChevronRight className="h-6 w-6" />
              <span className="sr-only">Next</span>
            </Button>
          </div>

          {/* Footer with thumbnails or indicators */}
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/50 p-3">
            {/* Desktop thumbnails */}
            <div className="hidden sm:flex justify-center items-center gap-2 overflow-x-auto h-16">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "flex-shrink-0 w-16 h-16 rounded-md overflow-hidden transition-all",
                    index === currentIndex ? "ring-2 ring-white scale-105" : "opacity-60 hover:opacity-100",
                  )}
                  aria-label={`Go to photo ${index + 1}`}
                  aria-current={index === currentIndex ? "true" : "false"}
                >
                  <img
                    src={photo.baseUrl || "/placeholder.svg"}
                    alt={`Thumbnail ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder.svg"
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Mobile indicators */}
            <div className="flex sm:hidden justify-center items-center space-x-1 h-8">
              {photos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentIndex ? "bg-white w-4" : "bg-white/50",
                  )}
                  aria-label={`Go to photo ${index + 1}`}
                  aria-current={index === currentIndex ? "true" : "false"}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
}

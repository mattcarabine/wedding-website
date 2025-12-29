"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRight, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PhotoType } from "@/lib/google-photos"
import { FullScreenPhotoViewer } from "./full-screen-photo-viewer"

interface AccordionPhotoGalleryProps {
  photos: PhotoType[]
}

export function AccordionPhotoGallery({ photos }: AccordionPhotoGalleryProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)

  const openPhoto = (index: number) => {
    setSelectedPhotoIndex(index)
  }

  const closeViewer = () => {
    setSelectedPhotoIndex(null)
  }

  // Show only first 6 photos in accordion (these are the most recent due to API ordering)
  const displayPhotos = photos.slice(0, 6)

  if (photos.length === 0) {
    return (
      <div className="text-center py-8">
        <Camera className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
        <h3 className="font-serif text-lg mb-2">No photos yet</h3>
        <p className="text-muted-foreground text-sm">Be the first to share a memory from our special day</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {photos.length} photo{photos.length !== 1 ? "s" : ""} and message{photos.length !== 1 ? "s" : ""} shared so
          far
        </p>

        <div className="grid grid-cols-3 gap-2">
          {displayPhotos.map((photo, index) => (
            <div
              key={photo.id}
              className="aspect-square relative cursor-pointer overflow-hidden rounded-lg group"
              onClick={() => openPhoto(index)}
            >
              <div className="relative h-full w-full">
                <Image
                  src={photo.baseUrl || "/placeholder.svg"}
                  alt={photo.filename || `Photo ${index + 1}`}
                  sizes="(max-width: 640px) 33vw, 25vw"
                  className="rounded-lg transition-transform group-hover:scale-105 object-cover"
                  fill
                  onError={(e) => {
                    // Fallback to placeholder on error
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg"
                  }}
                />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            </div>
          ))}
        </div>

        {photos.length > 6 && (
          <div className="text-center pt-2">
            <Link href="/gallery">
              <Button variant="outline" size="sm" className="gap-2 rounded-full">
                View all {photos.length} photos <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}
      </div>

      {selectedPhotoIndex !== null && (
        <FullScreenPhotoViewer photos={photos} initialIndex={selectedPhotoIndex} onClose={closeViewer} />
      )}
    </>
  )
}

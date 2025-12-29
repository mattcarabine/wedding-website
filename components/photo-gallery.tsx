"use client"

import type React from "react"
import { useState } from "react"
import Image from "next/image"
import type { PhotoType } from "@/lib/google-photos"
import { FullScreenPhotoViewer } from "./full-screen-photo-viewer"

interface PhotoGalleryProps {
  photos: PhotoType[]
}

export function PhotoGallery({ photos }: PhotoGalleryProps) {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null)

  const openPhoto = (index: number) => {
    setSelectedPhotoIndex(index)
  }

  const closeViewer = () => {
    setSelectedPhotoIndex(null)
  }

  if (photos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No photos have been shared yet.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="aspect-square relative cursor-pointer overflow-hidden rounded-lg group"
            onClick={() => openPhoto(index)}
            style={
              {
                "--rotation": `${Math.random() * 3 - 1.5}deg`,
              } as React.CSSProperties
            }
          >
            <div className="photo-frame rounded-lg h-full w-full">
              <div className="relative h-full w-full">
                <Image
                  src={photo.baseUrl || "/placeholder.svg"}
                  alt={photo.filename || `Photo ${index + 1}`}
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                  className="rounded-lg transition-transform group-hover:scale-105 duration-300 ease-in-out object-cover"
                  priority={false}
                  loading="lazy"
                  fill
                  onError={(e) => {
                    // Fallback to placeholder on error
                    const target = e.target as HTMLImageElement
                    target.src = "/placeholder.svg"
                  }}
                />
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {selectedPhotoIndex !== null && (
        <FullScreenPhotoViewer photos={photos} initialIndex={selectedPhotoIndex} onClose={closeViewer} />
      )}
    </>
  )
}

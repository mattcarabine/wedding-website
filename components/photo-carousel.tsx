"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { PhotoType } from "@/lib/google-photos"

interface PhotoCarouselProps {
  photos: PhotoType[]
  count?: number
}

export function PhotoCarousel({ photos, count = 5 }: PhotoCarouselProps) {
  const [randomPhotos, setRandomPhotos] = useState<PhotoType[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  // Get random photos on component mount
  useEffect(() => {
    if (photos.length === 0) {
      setIsLoading(false)
      return
    }

    // Get random photos
    const getRandomPhotos = () => {
      const shuffled = [...photos].sort(() => 0.5 - Math.random())
      return shuffled.slice(0, Math.min(count, photos.length))
    }

    setRandomPhotos(getRandomPhotos())
    setIsLoading(false)
  }, [photos, count])

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex === randomPhotos.length - 1 ? 0 : prevIndex + 1))
  }

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? randomPhotos.length - 1 : prevIndex - 1))
  }

  if (isLoading) {
    return (
      <div className="w-full aspect-video bg-muted/30 rounded-lg flex items-center justify-center">
        <div className="animate-pulse">
          <Camera className="h-8 w-8 text-muted-foreground/30" />
        </div>
      </div>
    )
  }

  if (randomPhotos.length === 0) {
    return null
  }

  return (
    <div className="relative w-full">
      <div className="overflow-hidden rounded-lg">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {randomPhotos.map((photo, index) => (
            <div key={photo.id} className="w-full flex-shrink-0">
              <div className="relative aspect-video">
                <Image
                  src={photo.baseUrl || "/placeholder.svg"}
                  alt={photo.filename || "Wedding photo"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={index === currentIndex}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {randomPhotos.length > 1 && (
        <>
          <Button
            variant="outline"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90 rounded-full h-9 w-9 shadow-md"
            onClick={prevSlide}
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90 rounded-full h-9 w-9 shadow-md"
            onClick={nextSlide}
            aria-label="Next photo"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {randomPhotos.map((_, index) => (
              <button
                key={index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/60 hover:bg-white/80",
                )}
                onClick={() => setCurrentIndex(index)}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

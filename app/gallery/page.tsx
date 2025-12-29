import { PhotoGallery } from "@/components/photo-gallery"
import { getPhotos } from "@/lib/google-photos"
import Link from "next/link"
import { ChevronLeft, Camera, Maximize2 } from "lucide-react"
import { FlowerDivider, WeddingTitle } from "@/components/decorative-elements"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function GalleryPage() {
  let photos = []

  try {
    photos = await getPhotos()
  } catch (error) {
    console.error("Failed to fetch photos:", error)
    // Continue with empty photos array
  }

  return (
    <main className="min-h-screen page-background">
      <div className="page-content min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-12 sm:px-6 sm:py-16">
          <div className="space-y-8">
            {/* Header */}
            <div className="text-center space-y-2">
              <WeddingTitle />
            </div>

            <FlowerDivider />

            {/* Gallery Navigation */}
            <div className="flex items-center justify-between">
              <Link
                href="/"
                className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to main page
              </Link>
              <div className="text-center">
                <h2 className="font-serif text-2xl font-medium">Our Wedding Gallery</h2>
                {photos.length > 0 && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <Maximize2 className="h-3 w-3" />
                    Tap any photo for full-screen view
                  </p>
                )}
              </div>
              <div className="w-24"></div> {/* Spacer for centering */}
            </div>

            {/* Gallery */}
            <div className="wedding-card rounded-xl p-4 sm:p-6">
              {photos.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-muted-foreground text-sm">
                      {photos.length} photo{photos.length !== 1 ? "s" : ""} and message{photos.length !== 1 ? "s" : ""}{" "}
                      shared • Swipe or use arrows to navigate in full-screen
                    </p>
                  </div>
                  <PhotoGallery photos={photos} />
                </div>
              ) : (
                <div className="text-center py-16 px-4">
                  <Camera className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-serif text-2xl mb-2">No photos yet</h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    Be the first to share a memory from our special day
                  </p>
                  <Link href="/" className="mt-6 inline-block">
                    <button className="px-6 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
                      Upload Photos
                    </button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

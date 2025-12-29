import { AccordionUploadForm } from "@/components/accordion-upload-form"
import { AccordionGuestBook } from "@/components/accordion-guest-book"
import { AccordionPhotoGallery } from "@/components/accordion-photo-gallery"
import { getPhotos } from "@/lib/google-photos"
import { Upload, MessageSquare, Camera } from "lucide-react"
import { WeddingTitle } from "@/components/decorative-elements"
import {
  WeddingAccordion,
  WeddingAccordionItem,
  WeddingAccordionTrigger,
  WeddingAccordionContent,
} from "@/components/wedding-accordion"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function Home() {
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
        <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 sm:py-12">
          <div className="space-y-8">
            {/* Header */}
            <div className="header-container">
              <div className="text-center">
                <WeddingTitle />
                <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">
                  Welcome to our wedding photo collection.</p>
                  <p className="text-muted-foreground mt-4 max-w-2xl mx-auto">Share your photos, leave messages, and explore memories from
                  our special day.
                </p>
              </div>
            </div>

            {/* Accordion Sections */}
            <WeddingAccordion type="multiple" defaultValue={["upload"]} className="w-full">
              {/* Upload Photos Section - Default Open */}
              <WeddingAccordionItem value="upload">
                <WeddingAccordionTrigger icon={<Upload className="h-5 w-5" />}>
                  Share Your Photos
                </WeddingAccordionTrigger>
                <WeddingAccordionContent>
                  <AccordionUploadForm />
                </WeddingAccordionContent>
              </WeddingAccordionItem>

              {/* Guest Book Section */}
              <WeddingAccordionItem value="guestbook">
                <WeddingAccordionTrigger icon={<MessageSquare className="h-5 w-5" />}>
                  Guest Book
                </WeddingAccordionTrigger>
                <WeddingAccordionContent>
                  <AccordionGuestBook />
                </WeddingAccordionContent>
              </WeddingAccordionItem>

              {/* Photo Gallery Section */}
              <WeddingAccordionItem value="gallery">
                <WeddingAccordionTrigger icon={<Camera className="h-5 w-5" />}>
                  Photo Gallery
                  {photos.length > 0 && (
                    <span className="ml-2 bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">
                      {photos.length}
                    </span>
                  )}
                </WeddingAccordionTrigger>
                <WeddingAccordionContent>
                  <AccordionPhotoGallery photos={photos} />
                </WeddingAccordionContent>
              </WeddingAccordionItem>
            </WeddingAccordion>
          </div>
        </div>
      </div>
    </main>
  )
}

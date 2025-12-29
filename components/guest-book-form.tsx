"use client"

import type React from "react"
import { useState } from "react"
import { MessageSquare, Loader2, Heart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { createAndUploadGuestBookImage } from "@/lib/guest-book-upload-service"
// Import the GuestBookPreview component
import { GuestBookPreview } from "@/components/guest-book-preview"

export function GuestBookForm() {
  const [guestName, setGuestName] = useState("")
  const [message, setMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  // Add a showPreview state variable after the other state variables
  const [showPreview, setShowPreview] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!guestName.trim() || !message.trim()) {
      toast({
        title: "Please fill in all fields",
        description: "Both your name and message are required.",
        variant: "destructive",
      })
      return
    }

    if (message.length > 280) {
      toast({
        title: "Message too long",
        description: "Please keep your message under 280 characters.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      // Generate image and upload directly from the client
      const result = await createAndUploadGuestBookImage({
        guestName: guestName.trim(),
        message: message.trim(),
      })

      if (!result.success) {
        throw new Error(result.error || "Failed to create guest book entry")
      }

      toast({
        title: "Thank you for your message!",
        description: "Your guest book entry has been added to our wedding album.",
      })

      // Clear form
      setGuestName("")
      setMessage("")
    } catch (error) {
      console.error("Guest book submission error:", error)
      toast({
        title: "Submission failed",
        description: "There was a problem submitting your message. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const remainingChars = 280 - message.length

  return (
    <div className="wedding-card rounded-xl p-6">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-2xl font-medium">Guest Book</h2>
        </div>
        <p className="text-muted-foreground text-sm">Leave us a message that will become part of our wedding album</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="guestName" className="block text-sm font-medium mb-2">
            Your Name
          </label>
          <input
            id="guestName"
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            maxLength={50}
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-2">
            Your Message
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share your wishes, memories, or advice for the happy couple..."
            rows={4}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
            maxLength={280}
            disabled={isSubmitting}
            onFocus={() => setShowPreview(true)}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-muted-foreground">Share your heartfelt wishes for Matt & Georgina</p>
            <span className={cn("text-xs", remainingChars < 20 ? "text-destructive" : "text-muted-foreground")}>
              {remainingChars} characters remaining
            </span>
          </div>
        </div>

        {/* Add the preview component here */}
        <GuestBookPreview
          message={message}
          guestName={guestName}
          show={showPreview && message.trim().length > 0 && guestName.trim().length > 0}
        />

        <Button
          type="submit"
          disabled={!guestName.trim() || !message.trim() || isSubmitting}
          className="w-full rounded-full h-12 transition-all"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating your message...
            </>
          ) : (
            <>
              <Heart className="mr-2 h-4 w-4" />
              Add to Guest Book
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

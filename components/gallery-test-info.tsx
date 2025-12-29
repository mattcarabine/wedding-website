"use client"

import { useState } from "react"
import { Info, X } from "lucide-react"

export function GalleryTestInfo() {
  const [showInfo, setShowInfo] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowInfo(true)}
        className="fixed bottom-4 right-4 z-40 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary/90 transition-colors"
        aria-label="Gallery info"
      >
        <Info className="h-5 w-5" />
      </button>

      {showInfo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg font-medium">Gallery Features</h3>
              <button onClick={() => setShowInfo(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div>• Tap any photo to view in full-screen</div>
              <div>• Swipe left/right to navigate on mobile</div>
              <div>• Use arrow keys on desktop</div>
              <div>• Tap image to zoom in/out on mobile</div>
              <div>• Download photos with the download button</div>
              <div>• Press Escape to close full-screen view</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

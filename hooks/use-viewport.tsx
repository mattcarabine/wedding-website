"use client"

import { useState, useEffect } from "react"

interface ViewportDimensions {
  width: number
  height: number
  orientation: "portrait" | "landscape"
}

export function useViewport(): ViewportDimensions {
  const [dimensions, setDimensions] = useState<ViewportDimensions>({
    width: 0,
    height: 0,
    orientation: "portrait",
  })

  useEffect(() => {
    const updateDimensions = () => {
      // Use visual viewport API if available (better for mobile)
      const width = window.visualViewport?.width || window.innerWidth
      const height = window.visualViewport?.height || window.innerHeight
      const orientation = width > height ? "landscape" : "portrait"

      setDimensions({
        width,
        height,
        orientation,
      })
    }

    // Initial update
    updateDimensions()

    // Add event listeners
    window.addEventListener("resize", updateDimensions)
    window.addEventListener("orientationchange", updateDimensions)

    // Visual viewport API specific event if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateDimensions)
    }

    return () => {
      window.removeEventListener("resize", updateDimensions)
      window.removeEventListener("orientationchange", updateDimensions)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateDimensions)
      }
    }
  }, [])

  return dimensions
}

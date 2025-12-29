"use client"

import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768

export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      // Check for touch capability
      const hasTouch =
        "ontouchstart" in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0

      // Check for mobile screen size
      const isMobileSize = window.innerWidth < MOBILE_BREAKPOINT

      // Check for mobile user agent (less reliable but helpful)
      const mobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

      // Consider it mobile if it has touch AND either has mobile size or mobile user agent
      setIsMobile(hasTouch && (isMobileSize || mobileUserAgent))
    }

    // Initial check
    checkMobile()

    // Add event listeners for resize and orientation change
    window.addEventListener("resize", checkMobile)
    window.addEventListener("orientationchange", checkMobile)

    // Clean up
    return () => {
      window.removeEventListener("resize", checkMobile)
      window.removeEventListener("orientationchange", checkMobile)
    }
  }, [])

  return isMobile
}

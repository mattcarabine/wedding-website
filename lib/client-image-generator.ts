/**
 * Client-side image generator for guest book entries
 * Uses browser Canvas API to create consistent images regardless of server environment
 */

// Define font loading and checking utility
export async function loadFonts(): Promise<boolean> {
  try {
    // Check if fonts are already available
    if (document.fonts.check('1em "Cormorant Garamond"') && document.fonts.check('1em "Montserrat"')) {
      console.log("Fonts already loaded")
      return true
    }

    console.log("Loading fonts...")

    // Load fonts with timeout
    const fontPromises = [
      document.fonts.load('400 1em "Cormorant Garamond"'),
      document.fonts.load('700 1em "Cormorant Garamond"'),
      document.fonts.load('400 1em "Montserrat"'),
      document.fonts.load('500 1em "Montserrat"'),
      document.fonts.load('italic 400 1em "Montserrat"'),
    ]

    // Add timeout to font loading
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Font loading timeout")), 3000)
    })

    await Promise.race([Promise.all(fontPromises), timeoutPromise])

    // Verify fonts are actually loaded
    const fontsReady = document.fonts.check('1em "Cormorant Garamond"') && document.fonts.check('1em "Montserrat"')

    console.log("Fonts loaded successfully:", fontsReady)
    return fontsReady
  } catch (error) {
    console.warn("Font loading failed, using fallbacks:", error)
    return false
  }
}

// Generate guest book image
export async function generateGuestBookImage(message: string, guestName: string): Promise<Blob> {
  console.log("Starting client-side image generation for:", { message: message.substring(0, 30), guestName })

  try {
    // Validate inputs
    if (!message || !guestName) {
      throw new Error("Message and guest name are required")
    }

    // Wait for fonts to load
    const fontsLoaded = await loadFonts()
    console.log("Fonts loaded:", fontsLoaded)

    // Canvas dimensions - using higher resolution for better quality
    const width = 1200
    const height = 900
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")

    if (!ctx) {
      throw new Error("Failed to get canvas context")
    }

    console.log("Canvas created:", { width, height })

    // Enable high-quality rendering
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"

    // Fill background with gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height)
    gradient.addColorStop(0, "#fef7f0")
    gradient.addColorStop(0.3, "#fdf2f8")
    gradient.addColorStop(0.7, "#f8fafc")
    gradient.addColorStop(1, "#f0f9ff")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    console.log("Background gradient applied")

    // Design constants
    const padding = 80
    const borderColor = "#d4a574"
    const textColor = "#374151"
    const accentColor = "#d4a574"
    const subtleColor = "#9ca3af"

    // Add outer decorative border
    ctx.strokeStyle = borderColor
    ctx.lineWidth = 4
    ctx.strokeRect(padding, padding, width - 2 * padding, height - 2 * padding)

    // Add inner border
    ctx.strokeStyle = "#e5b887"
    ctx.lineWidth = 2
    ctx.strokeRect(padding + 20, padding + 20, width - 2 * (padding + 20), height - 2 * (padding + 20))

    console.log("Borders added")

    // FIXED: Corner decorations with correct positioning
    const cornerLength = 25 // Length of each corner line
    const cornerThickness = 4 // Thickness of corner lines
    const cornerInset = 10 // How far inset from the border edge

    ctx.fillStyle = borderColor

    // Calculate border boundaries
    const borderLeft = padding
    const borderTop = padding
    const borderRight = width - padding
    const borderBottom = height - padding

    // Top-left corner
    // Horizontal line (top edge, extending right)
    ctx.fillRect(borderLeft + cornerInset, borderTop + cornerInset, cornerLength, cornerThickness)
    // Vertical line (left edge, extending down)
    ctx.fillRect(borderLeft + cornerInset, borderTop + cornerInset, cornerThickness, cornerLength)

    // Top-right corner
    // Horizontal line (top edge, extending left)
    ctx.fillRect(borderRight - cornerInset - cornerLength, borderTop + cornerInset, cornerLength, cornerThickness)
    // Vertical line (right edge, extending down)
    ctx.fillRect(borderRight - cornerInset - cornerThickness, borderTop + cornerInset, cornerThickness, cornerLength)

    // Bottom-left corner
    // Horizontal line (bottom edge, extending right)
    ctx.fillRect(borderLeft + cornerInset, borderBottom - cornerInset - cornerThickness, cornerLength, cornerThickness)
    // Vertical line (left edge, extending up)
    ctx.fillRect(borderLeft + cornerInset, borderBottom - cornerInset - cornerLength, cornerThickness, cornerLength)

    // Bottom-right corner
    // Horizontal line (bottom edge, extending left)
    ctx.fillRect(
      borderRight - cornerInset - cornerLength,
      borderBottom - cornerInset - cornerThickness,
      cornerLength,
      cornerThickness,
    )
    // Vertical line (right edge, extending up)
    ctx.fillRect(
      borderRight - cornerInset - cornerThickness,
      borderBottom - cornerInset - cornerLength,
      cornerThickness,
      cornerLength,
    )

    console.log("Corner decorations added with correct positioning")

    // Add additional decorative corner accents (small squares at the intersections)
    const accentSize = 6
    ctx.fillStyle = "#c9975a" // Slightly darker accent color

    // Corner accent squares at the intersection of each L-shaped corner
    // Top-left
    ctx.fillRect(borderLeft + cornerInset, borderTop + cornerInset, accentSize, accentSize)
    // Top-right
    ctx.fillRect(borderRight - cornerInset - accentSize, borderTop + cornerInset, accentSize, accentSize)
    // Bottom-left
    ctx.fillRect(borderLeft + cornerInset, borderBottom - cornerInset - accentSize, accentSize, accentSize)
    // Bottom-right
    ctx.fillRect(
      borderRight - cornerInset - accentSize,
      borderBottom - cornerInset - accentSize,
      accentSize,
      accentSize,
    )

    console.log("Corner accent squares added")

    // Set text alignment
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    // Prepare fonts with fallbacks
    const serifFont = fontsLoaded ? '"Cormorant Garamond", Georgia, serif' : "Georgia, serif"
    const sansFont = fontsLoaded ? '"Montserrat", Arial, sans-serif' : "Arial, sans-serif"

    // Calculate text area dimensions
    const textAreaWidth = width - 2 * (padding + 60)
    const textAreaTop = padding + 120
    const textAreaBottom = height - padding - 120

    // Prepare message text with improved word wrapping
    ctx.fillStyle = textColor
    const baseFontSize = Math.max(24, Math.min(32, textAreaWidth / 25)) // Responsive font size
    ctx.font = `${baseFontSize}px ${sansFont}`

    console.log("Font settings:", { baseFontSize, serifFont, sansFont })

    // Advanced word wrapping with better line breaking
    const words = message.split(/\s+/)
    const lines: string[] = []
    let currentLine = ""
    const maxLineWidth = textAreaWidth - 120 // Leave space for quotes

    for (const word of words) {
      const testLine = currentLine + (currentLine ? " " : "") + word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > maxLineWidth && currentLine) {
        lines.push(currentLine.trim())
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim())
    }

    console.log("Text wrapped into lines:", lines.length)

    // Calculate optimal line height and positioning
    const lineHeight = baseFontSize * 1.6
    const textBlockHeight = lines.length * lineHeight
    const textStartY = (textAreaTop + textAreaBottom - textBlockHeight) / 2

    // Calculate quote mark positions based on actual text dimensions
    const longestLineWidth = Math.max(...lines.map((line) => ctx.measureText(line).width))
    const quoteOffset = Math.max(80, (textAreaWidth - longestLineWidth) / 2 - 40)

    // Draw the message lines with improved spacing
    ctx.fillStyle = textColor
    ctx.font = `${baseFontSize}px ${sansFont}`

    lines.forEach((line, index) => {
      const lineY = textStartY + index * lineHeight
      ctx.fillText(line, width / 2, lineY)
    })

    console.log("Message text added")

    // Add decorative line above attribution
    const closeQuoteY = textStartY + textBlockHeight + lineHeight * 0.3
    const lineY = closeQuoteY + lineHeight * 0.8
    const lineWidth = 120
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(width / 2 - lineWidth / 2, lineY)
    ctx.lineTo(width / 2 + lineWidth / 2, lineY)
    ctx.stroke()

    // Add guest name with improved typography
    const nameFontSize = Math.max(26, baseFontSize * 1.1)
    ctx.fillStyle = subtleColor
    ctx.font = `italic ${nameFontSize}px ${sansFont}`
    ctx.fillText(`— ${guestName}`, width / 2, lineY + lineHeight)

    console.log("Guest name added")

    // Add wedding information at bottom with better spacing
    const bottomY = height - padding - 60
    // Add subtle decorative elements
    ctx.fillStyle = accentColor + "40" // Semi-transparent
    const heartSize = 8
    ctx.beginPath()
    ctx.arc(width / 2 - 15, bottomY - 25, heartSize / 2, 0, Math.PI * 2)
    ctx.arc(width / 2 + 15, bottomY - 25, heartSize / 2, 0, Math.PI * 2)
    ctx.fill()

    console.log("Decorative elements added")

    // Convert to blob with high quality
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) {
              console.log("High-quality image generated successfully, size:", blob.size)
              resolve(blob)
            } else {
              console.error("Canvas toBlob returned null or empty blob")
              reject(new Error("Failed to convert canvas to blob - blob is null or empty"))
            }
          },
          "image/png",
          1.0,
        ) // Maximum quality
      } catch (error) {
        console.error("Error in canvas.toBlob:", error)
        reject(error)
      }
    })
  } catch (error) {
    console.error("Error in generateGuestBookImage:", error)
    throw error
  }
}

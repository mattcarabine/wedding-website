import type React from "react"
import "./globals.css"
import "./photo-viewer.css"
import "./viewer-styles.css"
import type { Metadata } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "Matt & Georgina's Wedding",
  description:
    "Share and view photos from our special day. Upload your memories and browse our wedding photo collection.",
  keywords: ["wedding", "photos", "Matt", "Georgina", "celebration", "memories"],
  authors: [{ name: "Matt & Georgina" }],
  creator: "Matt & Georgina",
  openGraph: {
    title: "Matt & Georgina's Wedding Photos",
    description: "Share and view photos from our special day",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Matt & Georgina's Wedding Photos",
    description: "Share and view photos from our special day",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: "/favicon.png",
    shortcut: "/favicon.png",
  },
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />

        {/* Favicon - Wedding couple icon */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <link rel="shortcut icon" href="/favicon.png" />

        {/* Additional meta tags */}
        <meta name="theme-color" content="#D4A574" />
        <meta name="description" content="Share and view photos from Matt & Georgina's wedding celebration" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light">
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

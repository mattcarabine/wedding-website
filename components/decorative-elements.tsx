import type React from "react"
import { cn } from "@/lib/utils"
import Link from "next/link"

interface FlowerDividerProps {
  className?: string
}

export function FlowerDivider({ className }: FlowerDividerProps) {
  return (
    <div className={cn("flex items-center justify-center my-6", className)}>
      <div className="h-px bg-primary/20 flex-grow max-w-[100px]"></div>
      <div className="mx-4 text-primary">❦</div>
      <div className="h-px bg-primary/20 flex-grow max-w-[100px]"></div>
    </div>
  )
}

interface DecorativeFrameProps {
  children: React.ReactNode
  className?: string
}

export function DecorativeFrame({ children, className }: DecorativeFrameProps) {
  return (
    <div className={cn("relative p-6", className)}>
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-4 h-4 border-t border-l border-primary/30"></div>
      <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-primary/30"></div>
      <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-primary/30"></div>
      <div className="absolute bottom-0 right-0 w-4 h-4 border-b border-r border-primary/30"></div>

      {children}
    </div>
  )
}

export function WeddingTitle({ names = "Matt & Georgina", date = "May 25, 2025" }) {
  return (
    <div className="text-center">
      <Link href="/" className="block hover:opacity-80 transition-opacity">
        <h1 className="font-serif text-4xl md:text-5xl font-light tracking-wide text-primary">{names}</h1>
      </Link>
      <p className="text-sm uppercase tracking-widest mt-2 text-muted-foreground">{date}</p>
    </div>
  )
}

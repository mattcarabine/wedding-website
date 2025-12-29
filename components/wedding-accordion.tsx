"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const WeddingAccordion = AccordionPrimitive.Root

const WeddingAccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("wedding-card rounded-xl overflow-hidden mb-4", className)}
    {...props}
  />
))
WeddingAccordionItem.displayName = "WeddingAccordionItem"

const WeddingAccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    icon?: React.ReactNode
  }
>(({ className, children, icon, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between p-6 font-medium transition-all hover:bg-accent/50 [&[data-state=open]>svg]:rotate-180",
        "text-left font-serif text-xl md:text-2xl text-primary",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {icon && <div className="text-primary">{icon}</div>}
        {children}
      </div>
      <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200 text-primary/60" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
WeddingAccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const WeddingAccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("px-6 pb-6", className)}>{children}</div>
  </AccordionPrimitive.Content>
))

WeddingAccordionContent.displayName = AccordionPrimitive.Content.displayName

export { WeddingAccordion, WeddingAccordionItem, WeddingAccordionTrigger, WeddingAccordionContent }

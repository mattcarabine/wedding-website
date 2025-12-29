import { DecorativeFrame } from "./decorative-elements"

export function WelcomeMessage() {
  return (
    <div className="wedding-card rounded-xl p-6 text-center space-y-4">
      <h2 className="font-serif text-2xl font-medium">Welcome to Our Wedding Photo Collection</h2>

      <DecorativeFrame>
        <p className="text-muted-foreground">
          We're so happy you could join us for our special day! This website is a place for all our guests to share
          their photos and memories from our wedding celebration.
        </p>

        <p className="text-muted-foreground mt-4">
          Whether you captured a candid moment, a beautiful detail, or just a fun memory, we'd love to see it all.
          Please upload your photos using the form below.
        </p>

        <p className="text-primary font-medium mt-4">With love, Matt & Georgina</p>
      </DecorativeFrame>
    </div>
  )
}

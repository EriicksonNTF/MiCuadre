"use client"

import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith("/auth")
  const isOnboardingPage = pathname.startsWith("/onboarding")
  const isLandingPage = pathname === "/"
  const noSidebar = isAuthPage || isOnboardingPage || isLandingPage

  return (
    <div className={cn("main-content", noSidebar && "no-sidebar")}>
      {children}
    </div>
  )
}

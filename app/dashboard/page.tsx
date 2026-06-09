"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { AppSplash, DashboardLoadingIcon } from "@/components/dashboard/app-splash"

const DashboardContent = dynamic(() => import("@/components/dashboard/dashboard-content").then((mod) => mod.DashboardContent), {
  ssr: false,
  loading: () => <DashboardLoadingIcon />,
})

export default function DashboardPage() {
  const [showSplash, setShowSplash] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") return
    const alreadyShown = window.sessionStorage.getItem("micuadre_splash_seen") === "true"
    if (alreadyShown) {
      setShowSplash(false)
      return
    }
    const timer = window.setTimeout(() => {
      setShowSplash(false)
      window.sessionStorage.setItem("micuadre_splash_seen", "true")
    }, 1400)
    return () => window.clearTimeout(timer)
  }, [])

  if (showSplash) return <AppSplash />

  return <DashboardContent />
}

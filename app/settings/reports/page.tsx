"use client"

import dynamic from "next/dynamic"

const ReportsScreen = dynamic(() => import("@/components/settings/reports-screen").then((mod) => mod.ReportsScreen), {
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
})

export default function SettingsReportsPage() {
  return <ReportsScreen />
}

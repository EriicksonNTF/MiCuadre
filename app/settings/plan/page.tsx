"use client"

import dynamic from "next/dynamic"

const PlanScreen = dynamic(() => import("@/components/settings/plan-screen").then((mod) => mod.PlanScreen), {
  loading: () => (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  ),
})

export default function SettingsPlanPage() {
  return <PlanScreen />
}

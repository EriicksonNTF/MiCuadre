"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { SubscriptionsScreen } from "@/components/settings/subscriptions-screen"

function SettingsSubscriptionsInner() {
  const searchParams = useSearchParams()
  return <SubscriptionsScreen initialOpenCreate={searchParams.get("create") === "1"} />
}

export default function SettingsSubscriptionsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsSubscriptionsInner />
    </Suspense>
  )
}

"use client"

import type { ReactNode } from "react"
import { UpgradePrompt } from "@/components/entitlements/upgrade-prompt"
import type { FeatureKey } from "@/types/billing"

export function FeatureGate({
  allowed,
  children,
  fallback,
  title,
  description,
  feature,
}: {
  allowed: boolean
  children: ReactNode
  fallback?: ReactNode
  title?: string
  description?: string
  feature?: FeatureKey
}) {
  if (allowed) return <>{children}</>
  if (fallback) return <>{fallback}</>
  return <UpgradePrompt title={title} description={description} feature={feature} />
}

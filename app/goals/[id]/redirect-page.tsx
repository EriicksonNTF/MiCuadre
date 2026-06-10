"use client"

import { useEffect } from "react"
import { useRouter, useParams } from "next/navigation"

export function GoalRedirectPage() {
  const router = useRouter()
  useEffect(() => { router.replace("/planning") }, [router])
  return null
}

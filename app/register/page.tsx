"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RegisterRoutePage() {
  const router = useRouter()
  useEffect(() => { router.replace("/auth/sign-up") }, [router])
  return null
}

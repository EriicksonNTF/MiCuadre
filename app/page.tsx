import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { PublicLanding } from "@/components/landing/public-landing"
import { createClient } from "@/lib/supabase/server"

export default async function RootPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  const headersList = await headers()
  const userAgent = headersList.get("user-agent") || ""
  const isCapacitor = userAgent.toLowerCase().includes("capacitor") || userAgent.toLowerCase().includes("micuadrenative")

  if (isCapacitor) {
    redirect("/auth/login")
  }

  return <PublicLanding />
}

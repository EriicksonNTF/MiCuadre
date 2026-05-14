import { redirect } from "next/navigation"
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

  return <PublicLanding />
}

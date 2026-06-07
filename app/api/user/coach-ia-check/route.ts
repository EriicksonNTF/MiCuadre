import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isCoachIAEnabledForEmail } from "@/lib/feature-flags"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const allowed = isCoachIAEnabledForEmail(user?.email)
  return NextResponse.json({ allowed })
}

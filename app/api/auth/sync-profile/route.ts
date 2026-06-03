import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin")
  const appOrigin = request.nextUrl.origin

  if (requestOrigin && requestOrigin !== appOrigin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const provider = user.app_metadata?.provider || "email"
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || ""
  const avatarUrl = user.user_metadata?.avatar_url || ""

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email,
      full_name: fullName,
      first_name: fullName.split(" ")[0] || "",
      avatar_url: avatarUrl,
      provider,
    },
    { onConflict: "id" }
  )

  if (error) {
    return NextResponse.json({ error: "Profile sync failed" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

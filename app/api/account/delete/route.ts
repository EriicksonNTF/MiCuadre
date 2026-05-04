import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient as createAdminClient } from "@supabase/supabase-js"

async function createUserScopedClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function DELETE() {
  try {
    const supabase = await createUserScopedClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const userId = user.id

    const tablesByDependency = [
      "goal_contributions",
      "credit_payments",
      "transfers",
      "transactions",
      "goals",
      "beneficiaries",
      "notifications",
      "accounts",
    ]

    for (const table of tablesByDependency) {
      const { error } = await supabase.from(table).delete().eq("user_id", userId)
      if (error) {
        return NextResponse.json({ error: `Error eliminando ${table}` }, { status: 500 })
      }
    }

    const { error: profileError } = await supabase.from("profiles").delete().eq("id", userId)
    if (profileError) {
      return NextResponse.json({ error: "Error eliminando perfil" }, { status: 500 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: true, deletedAuthUser: false })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      return NextResponse.json({ error: "Error eliminando usuario de autenticación" }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deletedAuthUser: true })
  } catch (error) {
    console.error("Delete account route error:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}

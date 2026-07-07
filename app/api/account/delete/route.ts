import "server-only"

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function DELETE() {
  try {
    const supabase = await createClient()
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

    const adminClient = createAdminClient()

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

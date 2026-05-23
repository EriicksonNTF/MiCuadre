import "server-only"

import { createClient } from "@supabase/supabase-js"
import { assertServerEnv } from "@/lib/env/server"

export function createAdminClient() {
  const env = assertServerEnv()

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

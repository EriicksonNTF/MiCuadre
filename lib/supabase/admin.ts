import "server-only"

import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { assertServerEnv } from "@/lib/env/server"

let cachedClient: SupabaseClient | null = null

export function createAdminClient() {
  if (cachedClient) return cachedClient

  const env = assertServerEnv()

  cachedClient = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return cachedClient
}

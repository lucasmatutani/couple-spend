// NEVER import this file outside scripts/ — it uses the SERVICE_ROLE_KEY which bypasses RLS
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@splitwise/shared'

export function createAdminClient() {
  return createClient<Database>(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  )
}

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // No <Database> generic — see lib/supabase/server.ts for explanation.
  return createBrowserClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  )
}

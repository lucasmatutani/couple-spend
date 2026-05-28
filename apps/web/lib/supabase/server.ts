import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  // No <Database> generic here: @supabase/ssr v0.5 passes Schema as SupabaseClient's
  // SchemaName slot (3rd param), making Schema = never. Repositories cast results explicitly.
  return createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // CookieOptions (Partial<CookieSerializeOptions>) and ResponseCookie differ only
              // in their package declarations; the runtime shapes are compatible.
              // Cast the set function to accept CookieOptions to bridge the type gap.
              ;(cookieStore.set as unknown as (n: string, v: string, o: CookieOptions) => void)(
                name,
                value,
                options,
              )
            })
          } catch {
            // Intentional no-op in Server Component context.
            // Cookie mutations are handled by middleware.ts on the next request.
          }
        },
      },
    },
  )
}

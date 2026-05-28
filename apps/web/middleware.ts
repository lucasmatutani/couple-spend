import { createServerClient } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // No <Database> generic — see lib/supabase/server.ts for explanation.
  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            // CookieOptions (Partial<CookieSerializeOptions>) and ResponseCookie differ only
            // in their package declarations; the runtime shapes are compatible.
            ;(
              supabaseResponse.cookies.set as unknown as (
                n: string,
                v: string,
                o: CookieOptions,
              ) => void
            )(name, value, options)
          })
        },
      },
    },
  )

  // Refresh session on every request — required by @supabase/ssr.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Users created with a temporary password must change it before doing anything else.
  if (user?.user_metadata?.['must_change_password'] === true) {
    if (!pathname.startsWith('/auth/update-password') && !pathname.startsWith('/api/')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/update-password'
      return NextResponse.redirect(url)
    }
  }

  if (!user && pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/webhooks).*)'],
}

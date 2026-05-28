import { redirect } from 'next/navigation'

type Props = {
  searchParams: Promise<{ code?: string; next?: string }>
}

export default async function Home({ searchParams }: Props) {
  const { code, next } = await searchParams

  // Supabase falls back to site_url when emailRedirectTo isn't in the allow-list,
  // landing ?code= here instead of /auth/callback. Forward it transparently.
  if (code) {
    const qs = next ? `?code=${code}&next=${next}` : `?code=${code}`
    redirect(`/auth/callback${qs}`)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Splitwise</h1>
      <p className="mt-4 text-xl text-gray-600">
        Shared expense splitting &amp; personal finance tracking
      </p>
    </main>
  )
}

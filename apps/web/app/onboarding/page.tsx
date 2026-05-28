import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createHousehold } from './actions'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; token?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const step = params.step ?? '1'
  const token = params.token

  if (step === '2' && token) {
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'
    const joinUrl = `${appUrl}/join/${token}`
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Convide seu parceiro(a)</CardTitle>
            <CardDescription>
              Compartilhe este link para adicionar membros à sua casa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-mono break-all rounded-md bg-muted p-3">{joinUrl}</p>
          </CardContent>
          <CardFooter>
            <Link href="/dashboard" className="w-full">
              <Button variant="outline" className="w-full">
                Ir para o painel
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar sua casa</CardTitle>
          <CardDescription>Dê um nome para identificar o lar de vocês.</CardDescription>
        </CardHeader>
        <form action={createHousehold}>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="name">Nome da casa</Label>
              <Input id="name" name="name" placeholder="Ex: Lucas & Julia" required maxLength={80} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Criar e continuar
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { headers } from 'next/headers'
import { Target, Wifi, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { toUserId } from '@splitwise/domain'
import { generateInviteToken } from '@/lib/invite'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import InviteSection from './components/InviteSection'
import AddPartnerSection from './components/AddPartnerSection'

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const repo = new SupabaseHouseholdRepository()
  const household = await repo.findFirstByMember(toUserId(user.id))
  if (!household) redirect('/onboarding')

  const memberIds = household.members.map((m) => m.userId as string)
  const { data: memberProfiles } = await supabase
    .from('users')
    .select('id, display_name, email')
    .in('id', memberIds)

  const profiles = new Map((memberProfiles ?? []).map((p) => [p.id, p]))

  const token = await generateInviteToken(household.id as string)
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const inviteUrl = `${protocol}://${host}/join/${token}`

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold">Configurações</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Membros do lar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {household.members.map((m) => {
            const profile = profiles.get(m.userId as string)
            return (
              <div key={m.userId as string} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{profile?.display_name ?? 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
                <span className="text-xs capitalize text-muted-foreground">{m.role}</span>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar parceiro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Informe o e-mail do parceiro. Uma conta será criada automaticamente com uma senha
              temporária enviada por e-mail.
            </p>
            <AddPartnerSection />
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou compartilhe o link</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Compartilhe este link para o parceiro criar a própria conta. Expira em 7 dias.
            </p>
            <InviteSection inviteUrl={inviteUrl} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/dashboard/settings/goals" className="group">
          <Card className="h-full transition-colors group-hover:bg-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-4 w-4" />
                Metas de orçamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure limites e metas financeiras pessoais.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/settings/connections" className="group">
          <Card className="h-full transition-colors group-hover:bg-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="h-4 w-4" />
                Conexões Open Finance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Conecte sua conta bancária para importação automática.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}

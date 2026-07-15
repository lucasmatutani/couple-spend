import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { toHouseholdId, toUserId } from '@splitwise/domain'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import CreateCategoryForm from './CreateCategoryForm'

const BUCKET_LABELS: Record<string, string> = {
  needs: 'Necessidades',
  wants: 'Desejos',
  savings: 'Investimentos/Poupança',
}

const SPLIT_LABELS: Record<string, string> = {
  EQUAL: 'Dividir igualmente',
  ONLY_PAYER: 'Só quem pagou',
  ONLY_OTHER: 'Só o outro membro',
  CUSTOM: 'Percentual customizado',
}

export default async function CategoriesSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const household = await new SupabaseHouseholdRepository().findFirstByMember(toUserId(user.id))
  if (!household) redirect('/onboarding')

  const isOwner = household.members.some(
    (m) => (m.userId as string) === user.id && m.role === 'owner',
  )

  const categories = await new SupabaseCategoryRepository().findAll(toHouseholdId(household.id as string))
  const customCategories = categories.filter((c) => c.householdId !== null)
  const globalCategories = categories.filter((c) => c.householdId === null)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold">Categorias</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Categorias personalizadas do seu lar aparecem nas telas de despesas e na
          categorização automática da importação de faturas, ao lado das categorias
          padrão do sistema.
        </p>
      </div>

      {customCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Categorias do seu lar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {customCategories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
                <p className="text-sm font-medium">{c.name}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{BUCKET_LABELS[c.budgetBucket]}</Badge>
                  <Badge variant="outline">{SPLIT_LABELS[c.defaultSplitRule]}</Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova categoria</CardTitle>
        </CardHeader>
        <CardContent>
          {isOwner ? (
            <CreateCategoryForm />
          ) : (
            <p className="text-sm text-muted-foreground">
              Apenas o dono do lar pode criar categorias.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorias padrão do sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {globalCategories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0">
              <p className="text-sm text-muted-foreground">{c.name}</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{BUCKET_LABELS[c.budgetBucket]}</Badge>
                <Badge variant="outline">{SPLIT_LABELS[c.defaultSplitRule]}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

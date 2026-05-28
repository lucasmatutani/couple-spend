import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLimits } from '@splitwise/domain'
import type { PlanTier } from '@splitwise/domain'
import { getCurrentSubscription } from './actions'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import UpgradeButton from './components/UpgradeButton'

const PLAN_NAMES: Record<PlanTier, string> = {
  free: 'Free',
  pro: 'Pro',
  family: 'Family',
}

const PLAN_PRICES: Record<PlanTier, string> = {
  free: 'R$ 0',
  pro: 'R$ 19,90/mês',
  family: 'R$ 34,90/mês',
}

const BADGE_COLOR: Record<PlanTier, string> = {
  free: 'bg-gray-100 text-gray-800',
  pro: 'bg-blue-100 text-blue-800',
  family: 'bg-purple-100 text-purple-800',
}

type FeatureRow = {
  label: string
  free: string
  pro: string
  family: string
}

const FEATURE_ROWS: FeatureRow[] = [
  {
    label: 'Membros no household',
    free: String(getLimits('free').maxHouseholdMembers),
    pro: String(getLimits('pro').maxHouseholdMembers),
    family: String(getLimits('family').maxHouseholdMembers),
  },
  {
    label: 'Histórico de importação',
    free: `${getLimits('free').maxImportMonthsHistory} meses`,
    pro: `${getLimits('pro').maxImportMonthsHistory} meses`,
    family: `${getLimits('family').maxImportMonthsHistory} meses`,
  },
  {
    label: 'Categorização por IA',
    free: '✕',
    pro: '✓',
    family: '✓',
  },
  {
    label: 'Open Finance',
    free: '✕',
    pro: '✓',
    family: '✓',
  },
]

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('plan').eq('id', user.id).single()
  const currentTier: PlanTier = (profile?.plan ?? 'free') as PlanTier

  const subscription = await getCurrentSubscription()
  const { success } = await searchParams

  const proPriceId = process.env.STRIPE_PRO_PRICE_ID ?? ''
  const familyPriceId = process.env.STRIPE_FAMILY_PRICE_ID ?? ''

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Plano e cobrança</h2>
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${BADGE_COLOR[currentTier]}`}>
          {PLAN_NAMES[currentTier]}
        </span>
      </div>

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Assinatura ativada com sucesso! Seu plano foi atualizado.
        </div>
      )}

      {subscription?.cancelAtPeriodEnd && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠ Sua assinatura será cancelada em{' '}
          {subscription.currentPeriodEnd.toLocaleDateString('pt-BR')}. Gerencie sua assinatura para
          reativar.
        </div>
      )}

      {subscription && !subscription.cancelAtPeriodEnd && (
        <p className="text-sm text-muted-foreground">
          Próxima renovação:{' '}
          {subscription.currentPeriodEnd.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}

      {/* Plan comparison table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Comparar planos</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium text-muted-foreground">Recurso</th>
                {(['free', 'pro', 'family'] as PlanTier[]).map((tier) => (
                  <th
                    key={tier}
                    className={`py-2 text-center font-medium ${tier === currentTier ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    {PLAN_NAMES[tier]}
                    <br />
                    <span className="font-normal text-xs">{PLAN_PRICES[tier]}</span>
                    {tier === currentTier && (
                      <span className="ml-1 text-xs text-primary">(atual)</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label} className="border-b last:border-0">
                  <td className="py-3">{row.label}</td>
                  {(['free', 'pro', 'family'] as PlanTier[]).map((tier) => (
                    <td
                      key={tier}
                      className={`py-3 text-center ${tier === currentTier ? 'font-semibold text-primary' : ''}`}
                    >
                      {row[tier]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* CTA buttons */}
      <div className="grid gap-4 sm:grid-cols-2">
        {currentTier === 'free' && (
          <>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="font-semibold">Pro — R$ 19,90/mês</p>
                <p className="text-sm text-muted-foreground">
                  Até 5 membros, 24 meses de histórico, IA e Open Finance.
                </p>
                <UpgradeButton priceId={proPriceId} label="Assinar Pro" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="font-semibold">Family — R$ 34,90/mês</p>
                <p className="text-sm text-muted-foreground">
                  Até 10 membros, 60 meses de histórico, IA e Open Finance.
                </p>
                <UpgradeButton priceId={familyPriceId} label="Assinar Family" />
              </CardContent>
            </Card>
          </>
        )}

        {currentTier === 'pro' && (
          <>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="font-semibold">Family — R$ 34,90/mês</p>
                <p className="text-sm text-muted-foreground">
                  Até 10 membros e 60 meses de histórico.
                </p>
                <UpgradeButton priceId={familyPriceId} label="Fazer upgrade para Family" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <p className="font-semibold">Gerenciar assinatura</p>
                <p className="text-sm text-muted-foreground">
                  Altere, cancele ou atualize seu método de pagamento.
                </p>
                <UpgradeButton label="Abrir portal do cliente" variant="outline" />
              </CardContent>
            </Card>
          </>
        )}

        {currentTier === 'family' && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="font-semibold">Gerenciar assinatura</p>
              <p className="text-sm text-muted-foreground">
                Altere, cancele ou atualize seu método de pagamento.
              </p>
              <UpgradeButton label="Abrir portal do cliente" variant="outline" />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

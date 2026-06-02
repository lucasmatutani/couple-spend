import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { getIndividualBudgetUseCase, getInvestmentRepository } from '@/lib/container'
import { Money, YearMonth, toHouseholdId, toUserId } from '@splitwise/domain'
import {
  TrendingUp, TrendingDown, Minus,
  Wallet, PiggyBank, ArrowUpCircle, Target,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ExpensePieChart, { type PieSlice } from './components/ExpensePieChart'

function fmt(cents: number): string {
  return `R$ ${(Math.abs(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function prevMonthYM(month: YearMonth): YearMonth {
  const [y, m] = month.toString().split('-') as [string, string]
  const d = new Date(parseInt(y), parseInt(m) - 2, 1)
  return YearMonth.fromString(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
  )
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userId = toUserId(user.id)

  const { month: monthParam } = await searchParams
  let month: YearMonth
  try {
    month = YearMonth.fromString(monthParam ?? YearMonth.current().toString())
  } catch {
    month = YearMonth.current()
  }

  const householdRepo = new SupabaseHouseholdRepository()
  const household = await householdRepo.findFirstByMember(userId)
  if (!household) redirect('/onboarding')

  const householdId = toHouseholdId(household.id)
  const start = month.startDate().toISOString().split('T')[0]!
  const end = month.endDate().toISOString().split('T')[0]!
  const memberCount = household.members.length

  const prev = prevMonthYM(month)

  const [summary, prevSummary, categories, expenseRows, peRows] = await Promise.all([
    getIndividualBudgetUseCase().execute(userId, month),
    getIndividualBudgetUseCase().execute(userId, prev),
    new SupabaseCategoryRepository().findAll(householdId),
    supabase
      .from('expenses')
      .select('amount_cents, split_rule_type, split_rule_payer_percent, paid_by, category_id, description, occurred_at')
      .eq('household_id', household.id)
      .gte('occurred_at', start)
      .lte('occurred_at', end),
    supabase
      .from('personal_expenses')
      .select('amount_cents, category_id, split_parts, reimbursed, description, occurred_at')
      .eq('owner_id', user.id)
      .gte('occurred_at', start)
      .lte('occurred_at', end),
  ])

  const catName = new Map(categories.map((c) => [c.id as string, c.name]))

  // ── Compute household share + collect items per category ────────────────────
  let sharedShareCents = 0
  const householdByCat = new Map<string, number>()
  const itemsByCat = new Map<string, import('./components/ExpensePieChart').ExpenseItem[]>()

  function addItem(catKey: string, item: import('./components/ExpensePieChart').ExpenseItem) {
    const list = itemsByCat.get(catKey) ?? []
    list.push(item)
    itemsByCat.set(catKey, list)
  }

  for (const r of expenseRows.data ?? []) {
    let share = 0
    switch (r.split_rule_type) {
      case 'EQUAL': share = Math.round(r.amount_cents / memberCount); break
      case 'ONLY_PAYER': share = r.paid_by === user.id ? r.amount_cents : 0; break
      case 'ONLY_OTHER': share = r.paid_by !== user.id ? r.amount_cents : 0; break
      case 'CUSTOM': {
        const p = r.split_rule_payer_percent ?? 50
        share = Math.round(r.amount_cents * (r.paid_by === user.id ? p : 100 - p) / 100)
        break
      }
    }
    if (share <= 0) continue
    sharedShareCents += share
    const name = catName.get(r.category_id) ?? 'Outros'
    householdByCat.set(name, (householdByCat.get(name) ?? 0) + share)
    addItem(name, {
      description: r.description ?? null,
      occurredAt: r.occurred_at,
      amountCents: r.amount_cents,
      effectiveCents: share,
      source: 'casa',
    })
  }

  const personalSpentCents = summary.totalSpent.cents - sharedShareCents

  // ── Build pie chart data (personal effective + household share) ───────────
  const allByCat = new Map<string, number>(householdByCat)
  for (const r of peRows.data ?? []) {
    const isReimbursed = (r as Record<string, unknown>)['reimbursed'] as boolean ?? false
    if (isReimbursed) continue
    const effective = Math.round(r.amount_cents / ((r.split_parts ?? 1) as number))
    if (effective <= 0) continue
    const name = catName.get(r.category_id) ?? 'Outros'
    allByCat.set(name, (allByCat.get(name) ?? 0) + effective)
    addItem(name, {
      description: r.description ?? null,
      occurredAt: r.occurred_at,
      amountCents: r.amount_cents,
      effectiveCents: effective,
      source: 'pessoal',
    })
  }

  const pieData: PieSlice[] = Array.from(allByCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      items: (itemsByCat.get(name) ?? []).sort((a, b) =>
        b.occurredAt.localeCompare(a.occurredAt),
      ),
    }))

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const income = summary.totalIncome.cents
  const spent = summary.totalSpent.cents
  const invested = summary.totalInvested.cents
  const surplus = summary.surplus.cents
  const prevSurplus = prevSummary.surplus.cents

  const surplusDelta = surplus - prevSurplus
  const savingsRatePct = income > 0
    ? ((invested + Math.max(0, surplus)) / income) * 100
    : 0
  const annualProjection = surplus * 12

  // Budget bars (% of income)
  const barPersonal = income > 0 ? personalSpentCents / income : 0
  const barHousehold = income > 0 ? sharedShareCents / income : 0
  const barInvested = income > 0 ? invested / income : 0
  const barSurplus = income > 0 ? surplus / income : 0

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Visão geral</h2>

      {/* ── Row 1: Saldo + Taxa de poupança ─────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Saldo do mês */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo do mês</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${surplus >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {surplus < 0 ? '-' : ''}{fmt(surplus)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              {surplusDelta > 0
                ? <TrendingUp className="h-4 w-4 text-green-600" />
                : surplusDelta < 0
                  ? <TrendingDown className="h-4 w-4 text-destructive" />
                  : <Minus className="h-4 w-4" />}
              <span>
                {surplusDelta >= 0 ? '+' : '-'}{fmt(surplusDelta)} vs mês anterior
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Taxa de poupança */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de poupança</CardTitle>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${
              savingsRatePct >= 20 ? 'text-green-600'
              : savingsRatePct >= 10 ? 'text-yellow-600'
              : 'text-destructive'
            }`}>
              {savingsRatePct.toFixed(1)}%
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Meta: <span className="font-medium text-foreground">20%+</span>
              {savingsRatePct >= 20
                ? ' ✓ no caminho certo'
                : ` · faltam ${(20 - savingsRatePct).toFixed(1)} p.p.`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: 4 métricas de suporte ────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Renda</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{fmt(income)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total gasto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{fmt(spent)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{pct(income > 0 ? spent / income : 0)} da renda</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <ArrowUpCircle className="h-3 w-3" /> Investido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold text-blue-600">{fmt(invested)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{pct(income > 0 ? invested / income : 0)} da renda</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Target className="h-3 w-3" /> Projeção anual
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-xl font-semibold ${annualProjection >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {annualProjection < 0 ? '-' : ''}{fmt(annualProjection)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">se manter o ritmo</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Distribuição do orçamento ────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Para onde vai a renda</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: 'Pessoal', value: personalSpentCents, pctVal: barPersonal, color: 'bg-violet-500' },
            { label: 'Casa (minha parte)', value: sharedShareCents, pctVal: barHousehold, color: 'bg-amber-500' },
            { label: 'Investimentos', value: invested, pctVal: barInvested, color: 'bg-blue-500' },
            { label: 'Saldo livre', value: surplus, pctVal: barSurplus, color: surplus >= 0 ? 'bg-green-500' : 'bg-destructive' },
          ].map(({ label, value, pctVal, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{pct(Math.abs(pctVal))}</span>
                  <span className="font-medium tabular-nums w-28 text-right">
                    {value < 0 ? '-' : ''}{fmt(value)}
                  </span>
                </div>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${color} transition-all`}
                  style={{ width: `${Math.min(Math.abs(pctVal) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Row 4: Pie chart ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gastos por categoria</CardTitle>
          <p className="text-sm text-muted-foreground">Pessoal + casa (sua parte), sem reembolsos</p>
        </CardHeader>
        <CardContent>
          <ExpensePieChart data={pieData} />
        </CardContent>
      </Card>
    </div>
  )
}

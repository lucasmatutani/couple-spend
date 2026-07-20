import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { getIndividualBudgetUseCase, getInvestmentRepository } from '@/lib/container'
import { YearMonth, toHouseholdId, toUserId } from '@splitwise/domain'
import {
  TrendingUp, TrendingDown, Minus,
  Wallet, PiggyBank, ArrowUpCircle, Target, Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import MonthNavigator from '../components/MonthNavigator'
import ExpensePieChart, { type PieSlice } from './components/ExpensePieChart'
import BudgetAllocationCard, { type AllocationItem } from './components/BudgetAllocationCard'

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

const ASSET_CLASS_LABELS: Record<string, string> = {
  stocks: 'Ações',
  fixed_income: 'Renda Fixa',
  real_estate: 'FIIs',
  crypto: 'Cripto',
}

function buildSavingsInsight(invested3mCents: number, saved3mCents: number): string {
  if (saved3mCents > 0 && invested3mCents > 0) {
    return 'Você fechou os últimos 3 meses no azul e ainda investindo. Continue nesse ritmo — é assim que patrimônio se constrói.'
  }
  if (saved3mCents > 0) {
    return 'Você tem guardado dinheiro nos últimos meses. Que tal transformar parte dessa sobra em investimentos?'
  }
  if (invested3mCents > 0) {
    return 'Mesmo com o orçamento apertado, você seguiu investindo nos últimos meses. Continue priorizando isso.'
  }
  return 'Ainda não há sobra nos últimos meses, mas cada real guardado a partir de agora já faz diferença lá na frente.'
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

  // The consolidated insight cards always look at the real current month,
  // independent of whichever month is selected via the month navigator below.
  const realCurrentMonth = YearMonth.current()
  const realPrev = prevMonthYM(realCurrentMonth)
  const realPrev2 = prevMonthYM(realPrev)

  const [summary, prevSummary, insightCurrent, insightPrev1, insightPrev2, rawInvestments, categories, expenseRows, peRows] = await Promise.all([
    getIndividualBudgetUseCase().execute(userId, month),
    getIndividualBudgetUseCase().execute(userId, prev),
    getIndividualBudgetUseCase().execute(userId, realCurrentMonth),
    getIndividualBudgetUseCase().execute(userId, realPrev),
    getIndividualBudgetUseCase().execute(userId, realPrev2),
    getInvestmentRepository().findByOwnerAndMonth(userId, month),
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
  const householdItems: AllocationItem[] = []
  const personalItems: AllocationItem[] = []

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
    householdItems.push({
      description: r.description ?? null,
      occurredAt: r.occurred_at,
      amountCents: r.amount_cents,
      effectiveCents: share,
      category: name,
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
    personalItems.push({
      description: r.description ?? null,
      occurredAt: r.occurred_at,
      amountCents: r.amount_cents,
      effectiveCents: effective,
      category: name,
    })
  }

  householdItems.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  personalItems.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  const investmentItems: AllocationItem[] = rawInvestments
    .map((i) => ({
      description: i.description,
      occurredAt: i.occurredAt.toISOString().split('T')[0]!,
      amountCents: i.amount.cents,
      effectiveCents: i.amount.cents,
      category: ASSET_CLASS_LABELS[i.assetClass] ?? i.assetClass,
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

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

  // ── Consolidated insights (real current month + prior 2, regardless of the
  //    month selected below via the navigator) ──────────────────────────────
  const invested3mCents = insightCurrent.totalInvested.cents + insightPrev1.totalInvested.cents + insightPrev2.totalInvested.cents
  const avgInvested3mCents = Math.round(invested3mCents / 3)
  const saved3mCents = insightCurrent.surplus.cents + insightPrev1.surplus.cents + insightPrev2.surplus.cents
  const avgSaved3mCents = Math.round(saved3mCents / 3)
  const savingsInsightMessage = buildSavingsInsight(invested3mCents, saved3mCents)

  // Budget bars (% of income)
  const barPersonal = income > 0 ? personalSpentCents / income : 0
  const barHousehold = income > 0 ? sharedShareCents / income : 0
  const barInvested = income > 0 ? invested / income : 0
  const barSurplus = income > 0 ? surplus / income : 0

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Visão geral</h2>
        <p className="text-sm text-muted-foreground">
          Panorama consolidado dos últimos 3 meses — role para baixo para ver o detalhamento por mês
        </p>
      </div>

      {/* ── Insights: consolidado dos últimos 3 meses ───────────────────── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investido (últimos 3 meses)</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{fmt(invested3mCents)}</p>
            <p className="mt-1 text-xs text-muted-foreground">média de {fmt(avgInvested3mCents)}/mês</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Guardado (últimos 3 meses)</CardTitle>
            <PiggyBank className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${saved3mCents >= 0 ? 'text-green-600' : 'text-destructive'}`}>
              {saved3mCents < 0 ? '-' : ''}{fmt(saved3mCents)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              média de {avgSaved3mCents < 0 ? '-' : ''}{fmt(avgSaved3mCents)}/mês
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Sparkles className="h-4 w-4 text-green-700 dark:text-green-400" />
            <CardTitle className="text-sm font-medium text-green-800 dark:text-green-300">Continue assim</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-green-900 dark:text-green-200">{savingsInsightMessage}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Detalhamento por mês ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-t pt-6">
        <div>
          <h3 className="text-lg font-semibold">Detalhamento do mês</h3>
          <p className="text-sm text-muted-foreground">Escolha um mês para ver os números em detalhe</p>
        </div>
        <MonthNavigator alwaysShow />
      </div>

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
          <p className="text-sm text-muted-foreground">Clique em uma categoria para ver os lançamentos</p>
        </CardHeader>
        <CardContent>
          <BudgetAllocationCard
            rows={[
              { label: 'Pessoal', value: personalSpentCents, pctVal: barPersonal, color: 'bg-violet-500', items: personalItems },
              { label: 'Casa (minha parte)', value: sharedShareCents, pctVal: barHousehold, color: 'bg-amber-500', items: householdItems },
              { label: 'Investimentos', value: invested, pctVal: barInvested, color: 'bg-blue-500', items: investmentItems },
              { label: 'Saldo livre', value: surplus, pctVal: barSurplus, color: surplus >= 0 ? 'bg-green-500' : 'bg-destructive', items: null },
            ]}
          />
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

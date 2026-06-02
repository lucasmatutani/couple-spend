import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import {
  getIndividualBudgetUseCase,
  getInvestmentRepository,
  getGoalRepository,
  getEvaluateGoalsUseCase,
} from '@/lib/container'
import { Money, YearMonth, toHouseholdId, toUserId } from '@splitwise/domain'
import { Repeat } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BudgetSummaryDto, CategoryDto, IncomeDto, InvestmentDto, PersonalExpenseDto, RecurringPersonalExpenseDto } from './types'
import IncomeSummaryCard from './components/IncomeSummaryCard'
import BudgetBreakdownBar from './components/BudgetBreakdownBar'
import CategoryBreakdown from './components/CategoryBreakdown'
import RecurringPersonalExpensesSheet from './components/RecurringPersonalExpensesSheet'
import SurplusCard from './components/SurplusCard'
import InvestmentSummaryCard from './components/InvestmentSummaryCard'
import GoalStatusBanner from './components/GoalStatusBanner'
import CreditCardExpensesCard from './components/CreditCardExpensesCard'

export default async function IndividualPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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

  const [summary, incomeRows, personalExpenseRows, rawInvestments, categories, allGoals, recurringTemplates] =
    await Promise.all([
      getIndividualBudgetUseCase().execute(userId, month),
      // Direct query to include recurring_income_id
      supabase
        .from('incomes')
        .select('id, occurred_at, amount_cents, source, recurring, recurring_income_id')
        .eq('owner_id', user.id)
        .gte('occurred_at', start)
        .lte('occurred_at', end),
      // Direct query to include recurring_personal_expense_id
      supabase
        .from('personal_expenses')
        .select('id, occurred_at, amount_cents, description, category_id, recurring_personal_expense_id, payment_method, split_parts')
        .eq('owner_id', user.id)
        .gte('occurred_at', start)
        .lte('occurred_at', end),
      getInvestmentRepository().findByOwnerAndMonth(userId, month),
      new SupabaseCategoryRepository().findAll(householdId),
      getGoalRepository().findByOwner(userId),
      supabase
        .from('recurring_personal_expenses')
        .select('*')
        .eq('owner_id', user.id)
        .eq('active', true)
        .order('created_at'),
    ])

  // 3-month moving average
  const prior2 = await Promise.all(
    [1, 2].map((offset) => {
      const [y, m] = month.toString().split('-') as [string, string]
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1 - offset, 1)
      const ym = YearMonth.fromString(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      )
      return getIndividualBudgetUseCase().execute(userId, ym)
    }),
  )
  const allSurpluses = [summary, ...prior2].map((s) => s.surplus.cents)
  const avgSurplus3mCents = Math.round(allSurpluses.reduce((a, b) => a + b, 0) / allSurpluses.length)

  const activeGoals = allGoals.filter(
    (g) => g.appliesToMonth === null || g.appliesToMonth.toString() === month.toString(),
  )
  const goalEvaluations = getEvaluateGoalsUseCase().execute(summary, activeGoals)

  const categoryMap = new Map(categories.map((c) => [c.id as string, c]))

  const budgetSummary: BudgetSummaryDto = {
    totalIncomeFormatted: summary.totalIncome.format(),
    totalIncomeCents: summary.totalIncome.cents,
    totalSpentFormatted: summary.totalSpent.format(),
    totalSpentCents: summary.totalSpent.cents,
    totalInvestedFormatted: summary.totalInvested.format(),
    totalInvestedCents: summary.totalInvested.cents,
    surplusFormatted: summary.surplus.format(),
    surplusCents: summary.surplus.cents,
    pctSpent: summary.pctSpent,
    pctInvested: summary.pctInvested,
    avgSurplus3mCents,
    avgSurplus3mFormatted: Money.of(avgSurplus3mCents).format(),
  }

  const incomeDtos: IncomeDto[] = (incomeRows.data ?? []).map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    amountFormatted: `R$ ${(r.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    amountCents: r.amount_cents,
    source: r.source,
    recurring: r.recurring,
    recurringIncomeId: r.recurring_income_id,
  }))

  const peRows = personalExpenseRows.data ?? []
  const personalExpenseDtos: PersonalExpenseDto[] = peRows.map((r) => {
    const cat = categoryMap.get(r.category_id)
    return {
      id: r.id,
      occurredAt: r.occurred_at,
      amountFormatted: `R$ ${(r.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      amountCents: r.amount_cents,
      description: r.description,
      categoryId: r.category_id,
      categoryName: cat?.name ?? 'Sem categoria',
      budgetBucket: cat?.budgetBucket ?? 'needs',
      recurringPersonalExpenseId: r.recurring_personal_expense_id,
      paymentMethod: (r.payment_method ?? null) as PersonalExpenseDto['paymentMethod'],
      splitParts: r.split_parts ?? 1,
    }
  })

  const investmentDtos: InvestmentDto[] = rawInvestments.map((i) => ({
    id: i.id,
    occurredAt: i.occurredAt.toISOString().split('T')[0]!,
    amountFormatted: i.amount.format(),
    amountCents: i.amount.cents,
    assetClass: i.assetClass,
    description: i.description,
  }))

  const categoryDtos: CategoryDto[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    budgetBucket: c.budgetBucket,
  }))

  const recurringPersonalDtos: RecurringPersonalExpenseDto[] = (recurringTemplates.data ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    amountCents: r.amount_cents,
    amountFormatted: `R$ ${(r.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    categoryId: r.category_id,
    categoryName: categoryMap.get(r.category_id)?.name ?? 'Sem categoria',
    installmentCount: r.installment_count,
  }))

  const recurringTotalCents = peRows
    .filter((r) => r.recurring_personal_expense_id !== null)
    .reduce((sum, r) => sum + r.amount_cents, 0)

  const recurringTotalFormatted = `R$ ${(recurringTotalCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Orçamento individual</h2>
        <RecurringPersonalExpensesSheet
          categories={categoryDtos}
          recurringExpenses={recurringPersonalDtos}
          currentMonth={month.toString()}
        />
      </div>

      <BudgetBreakdownBar summary={budgetSummary} />

      <div className="grid gap-4 md:grid-cols-2">
        <SurplusCard summary={budgetSummary} />
        <InvestmentSummaryCard investments={investmentDtos} summary={budgetSummary} currentMonth={month.toString()} />
      </div>

      <IncomeSummaryCard incomes={incomeDtos} totalIncomeCents={budgetSummary.totalIncomeCents} currentMonth={month.toString()} />

      {recurringTotalCents > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Repeat className="h-4 w-4" />
              Despesas fixas no mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{recurringTotalFormatted}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {peRows.filter((r) => r.recurring_personal_expense_id !== null).length} despesa(s) recorrente(s)
            </p>
          </CardContent>
        </Card>
      )}

      <GoalStatusBanner
        evaluations={goalEvaluations}
        totalIncomeCents={budgetSummary.totalIncomeCents}
      />

      <CreditCardExpensesCard
        expenses={personalExpenseDtos}
        categories={categoryDtos}
        currentMonth={month.toString()}
      />

      <CategoryBreakdown
        expenses={personalExpenseDtos}
        categories={categoryDtos}
        totalIncomeCents={budgetSummary.totalIncomeCents}
        currentMonth={month.toString()}
      />
    </div>
  )
}

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import {
  getIndividualBudgetUseCase,
  getIncomeRepository,
  getInvestmentRepository,
  getPersonalExpenseRepository,
  getGoalRepository,
  getEvaluateGoalsUseCase,
} from '@/lib/container'
import { Money, YearMonth, toHouseholdId, toUserId } from '@splitwise/domain'
import type { BudgetSummaryDto, CategoryDto, IncomeDto, InvestmentDto, PersonalExpenseDto } from './types'
import IncomeSummaryCard from './components/IncomeSummaryCard'
import BudgetBreakdownBar from './components/BudgetBreakdownBar'
import CategoryBreakdown from './components/CategoryBreakdown'
import SurplusCard from './components/SurplusCard'
import InvestmentSummaryCard from './components/InvestmentSummaryCard'
import GoalStatusBanner from './components/GoalStatusBanner'

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

  // Compute current month summary, raw lists, and goals in parallel
  const [summary, rawIncomes, rawPersonalExpenses, rawInvestments, categories, allGoals] =
    await Promise.all([
      getIndividualBudgetUseCase().execute(userId, month),
      getIncomeRepository().findByOwnerAndMonth(userId, month),
      getPersonalExpenseRepository().findByOwnerAndMonth(userId, month),
      getInvestmentRepository().findByOwnerAndMonth(userId, month),
      new SupabaseCategoryRepository().findAll(householdId),
      getGoalRepository().findByOwner(userId),
    ])

  // 3-month moving average: average surplus of current + 2 prior months
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

  // Filter goals applicable to this month
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

  const incomeDtos: IncomeDto[] = rawIncomes.map((i) => ({
    id: i.id,
    occurredAt: i.occurredAt.toISOString().split('T')[0]!,
    amountFormatted: i.amount.format(),
    amountCents: i.amount.cents,
    source: i.source,
    recurring: i.recurring,
  }))

  const personalExpenseDtos: PersonalExpenseDto[] = rawPersonalExpenses.map((e) => {
    const cat = categoryMap.get(e.categoryId)
    return {
      id: e.id,
      occurredAt: e.occurredAt.toISOString().split('T')[0]!,
      amountFormatted: e.amount.format(),
      amountCents: e.amount.cents,
      description: e.description,
      categoryId: e.categoryId,
      categoryName: cat?.name ?? 'Sem categoria',
      budgetBucket: cat?.budgetBucket ?? 'needs',
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

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Orçamento individual</h2>

      <BudgetBreakdownBar summary={budgetSummary} />

      <div className="grid gap-4 md:grid-cols-2">
        <SurplusCard summary={budgetSummary} />
        <InvestmentSummaryCard investments={investmentDtos} summary={budgetSummary} />
      </div>

      <IncomeSummaryCard incomes={incomeDtos} totalIncomeCents={budgetSummary.totalIncomeCents} />

      <GoalStatusBanner
        evaluations={goalEvaluations}
        totalIncomeCents={budgetSummary.totalIncomeCents}
      />

      <CategoryBreakdown
        expenses={personalExpenseDtos}
        categories={categoryDtos}
        totalIncomeCents={budgetSummary.totalIncomeCents}
      />
    </div>
  )
}

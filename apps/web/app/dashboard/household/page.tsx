import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { SupabaseExpenseRepository } from '@/lib/repositories/SupabaseExpenseRepository'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { SupabaseUserRepository } from '@/lib/repositories/SupabaseUserRepository'
import { getHouseholdSplitUseCase } from '@/lib/container'
import { YearMonth, toHouseholdId, toUserId } from '@splitwise/domain'
import type { CategoryDto, ExpenseDto, MemberBalanceDto, SettlementDto } from './types'
import AddExpenseSheet from './components/AddExpenseSheet'
import ExpenseList from './components/ExpenseList'
import SettlementSuggestions from './components/SettlementSuggestions'
import SplitSummaryCards from './components/SplitSummaryCards'

export default async function HouseholdPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const householdRepo = new SupabaseHouseholdRepository()
  const household = await householdRepo.findFirstByMember(toUserId(user.id))
  if (!household) redirect('/onboarding')

  const { month: monthParam } = await searchParams
  let month: YearMonth
  try {
    month = YearMonth.fromString(monthParam ?? YearMonth.current().toString())
  } catch {
    month = YearMonth.current()
  }

  const householdId = toHouseholdId(household.id)

  const [summary, rawExpenses, categories] = await Promise.all([
    getHouseholdSplitUseCase().execute(householdId, month),
    new SupabaseExpenseRepository().findByHouseholdAndMonth(householdId, month),
    new SupabaseCategoryRepository().findAll(householdId),
  ])

  const memberIds = household.members.map((m) => m.userId)
  const profiles = await new SupabaseUserRepository().findManyById(memberIds)
  const profileMap = new Map(profiles.map((p) => [p.id as string, p.displayName]))
  const categoryMap = new Map(categories.map((c) => [c.id as string, c.name]))

  const memberBalances: MemberBalanceDto[] = summary.memberBalances.map((b) => ({
    userId: b.userId,
    displayName: b.displayName,
    paidFormatted: b.paid.format(),
    paidCents: b.paid.cents,
    sharedShareFormatted: b.sharedShare.format(),
    netFormatted: b.net.format(),
    netCents: b.net.cents,
  }))

  const settlements: SettlementDto[] = summary.settlements.map((s) => ({
    from: s.from,
    fromDisplayName: s.fromDisplayName,
    to: s.to,
    toDisplayName: s.toDisplayName,
    amountFormatted: s.amount.format(),
    amountCents: s.amount.cents,
  }))

  const expenses: ExpenseDto[] = rawExpenses.map((e) => ({
    id: e.id,
    occurredAt: e.occurredAt.toISOString().split('T')[0]!,
    description: e.description,
    amountFormatted: e.amount.format(),
    amountCents: e.amount.cents,
    splitRuleType: e.splitRule.type,
    splitRulePayerPercent: e.splitRule.payerPercent ?? null,
    paidByDisplayName: profileMap.get(e.paidBy) ?? e.paidBy,
    categoryName: categoryMap.get(e.categoryId) ?? 'Sem categoria',
    categoryId: e.categoryId,
    householdId: e.householdId,
  }))

  const categoryDtos: CategoryDto[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    defaultSplitRule: c.defaultSplitRule,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Despesas da casa</h2>
        <AddExpenseSheet
          householdId={household.id}
          categories={categoryDtos}
          currentUserId={user.id}
        />
      </div>

      <SplitSummaryCards
        memberBalances={memberBalances}
        totalExpensesFormatted={summary.totalExpenses.format()}
      />

      {settlements.length > 0 && (
        <SettlementSuggestions settlements={settlements} month={month.toString()} />
      )}

      <ExpenseList expenses={expenses} categories={categoryDtos} householdId={household.id} />
    </div>
  )
}

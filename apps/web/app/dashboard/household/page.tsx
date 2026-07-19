import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { SupabaseUserRepository } from '@/lib/repositories/SupabaseUserRepository'
import { getHouseholdSplitUseCase } from '@/lib/container'
import { YearMonth, toHouseholdId, toUserId } from '@splitwise/domain'
import type { CategoryDto, ExpenseDto, MemberBalanceDto, RecurringExpenseDto } from './types'
import AddExpenseSheet from './components/AddExpenseSheet'
import ExpenseList from './components/ExpenseList'
import RecurringExpensesSheet from './components/RecurringExpensesSheet'
import SplitSummaryCards from './components/SplitSummaryCards'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageTransition } from '@/components/ui/animated'
import { Receipt, Repeat } from 'lucide-react'

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
  const start = month.startDate().toISOString().split('T')[0]!
  const end = month.endDate().toISOString().split('T')[0]!

  const [summary, expenseRows, categories, recurringTemplates] = await Promise.all([
    getHouseholdSplitUseCase().execute(householdId, month),
    supabase
      .from('expenses')
      .select('id, occurred_at, description, amount_cents, split_rule_type, split_rule_payer_percent, paid_by, category_id, household_id, recurring_expense_id, is_recurring')
      .eq('household_id', household.id)
      .gte('occurred_at', start)
      .lte('occurred_at', end)
      .order('occurred_at', { ascending: false }),
    new SupabaseCategoryRepository().findAll(householdId),
    supabase
      .from('recurring_expenses')
      .select('*')
      .eq('household_id', household.id)
      .eq('active', true)
      .order('created_at'),
  ])

  const memberIds = household.members.map((m) => m.userId)
  const profiles = await new SupabaseUserRepository().findManyById(memberIds)
  const profileMap = new Map(profiles.map((p) => [p.id as string, p.displayName]))

  const currentUserName = profileMap.get(user.id) ?? 'Eu'
  const otherMember = household.members.find((m) => m.userId !== user.id)
  const otherMemberName = otherMember ? (profileMap.get(otherMember.userId) ?? null) : null
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

  const rows = expenseRows.data ?? []

  const expenses: ExpenseDto[] = rows.map((r) => ({
    id: r.id,
    occurredAt: r.occurred_at,
    description: r.description,
    amountFormatted: `R$ ${(r.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    amountCents: r.amount_cents,
    splitRuleType: r.split_rule_type,
    splitRulePayerPercent: r.split_rule_payer_percent,
    paidByDisplayName: profileMap.get(r.paid_by) ?? r.paid_by,
    categoryName: categoryMap.get(r.category_id) ?? 'Sem categoria',
    categoryId: r.category_id,
    householdId: r.household_id,
    recurringExpenseId: r.recurring_expense_id,
  }))

  const categoryDtos: CategoryDto[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    defaultSplitRule: c.defaultSplitRule,
  }))

  const recurringDtos: RecurringExpenseDto[] = (recurringTemplates.data ?? []).map((r) => ({
    id: r.id,
    description: r.description,
    amountCents: r.amount_cents,
    amountFormatted: `R$ ${(r.amount_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    categoryId: r.category_id,
    categoryName: categoryMap.get(r.category_id) ?? 'Sem categoria',
    splitRuleType: r.split_rule_type,
    splitRulePayerPercent: r.split_rule_payer_percent,
    installmentCount: r.installment_count,
  }))

  const recurringTotalCents = rows
    .filter((r) => r.is_recurring)
    .reduce((sum, r) => sum + r.amount_cents, 0)

  const recurringTotalFormatted = `R$ ${(recurringTotalCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <PageTransition>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Despesas da casa</h2>
        <div className="flex gap-2">
          <RecurringExpensesSheet
            householdId={household.id}
            categories={categoryDtos}
            recurringExpenses={recurringDtos}
            currentMonth={month.toString()}
            currentUserName={currentUserName}
            otherMemberName={otherMemberName}
          />
          <AddExpenseSheet
            householdId={household.id}
            categories={categoryDtos}
            currentUserName={currentUserName}
            otherMemberName={otherMemberName}
            currentMonth={month.toString()}
          />
        </div>
      </div>

      <SplitSummaryCards
        memberBalances={memberBalances}
        totalExpensesFormatted={summary.totalExpenses.format()}
      />

      {recurringTotalCents > 0 && (
        <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Receipt className="h-4 w-4" />
                Total de despesas no mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.totalExpenses.format()}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {rows.length} despesa(s) no mês
              </p>
            </CardContent>
          </Card>

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
                {rows.filter((r) => r.is_recurring).length} despesa(s) recorrente(s)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <ExpenseList expenses={expenses} categories={categoryDtos} householdId={household.id} />
    </div>
    </PageTransition>
  )
}

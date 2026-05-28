import { createClient } from '@/lib/supabase/server'
import {
  Expense,
  Money,
  SplitRule,
  toCategoryId,
  toExpenseId,
  toHouseholdId,
  toUserId,
  type ExpenseId,
  type ExpenseRepository,
  type HouseholdId,
  type SplitRuleType,
  type YearMonth,
} from '@splitwise/domain'

type ExpenseRow = {
  id: string
  household_id: string
  paid_by: string
  category_id: string
  occurred_at: string
  amount_cents: number
  description: string | null
  split_rule_type: SplitRuleType
  split_rule_payer_percent: number | null
  source_id: string
  external_id: string
  imported_at: string
}

function rowToExpense(row: ExpenseRow): Expense {
  let splitRule: SplitRule
  switch (row.split_rule_type) {
    case 'EQUAL':
      splitRule = SplitRule.equal()
      break
    case 'ONLY_PAYER':
      splitRule = SplitRule.onlyPayer()
      break
    case 'ONLY_OTHER':
      splitRule = SplitRule.onlyOther()
      break
    case 'CUSTOM':
      splitRule = SplitRule.custom(row.split_rule_payer_percent!)
      break
  }

  return Expense.create({
    id: toExpenseId(row.id),
    householdId: toHouseholdId(row.household_id),
    paidBy: toUserId(row.paid_by),
    categoryId: toCategoryId(row.category_id),
    occurredAt: new Date(row.occurred_at),
    amount: Money.of(row.amount_cents),
    description: row.description,
    splitRule,
    sourceId: row.source_id,
    externalId: row.external_id,
    importedAt: new Date(row.imported_at),
  })
}

export class SupabaseExpenseRepository implements ExpenseRepository {
  // RLS enforces household membership. The household_id filter below further scopes
  // to the requested household for users who belong to multiple households.

  async findByHouseholdAndMonth(householdId: HouseholdId, month: YearMonth): Promise<Expense[]> {
    const supabase = await createClient()
    const start = month.startDate().toISOString().split('T')[0]!
    const end = month.endDate().toISOString().split('T')[0]!

    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('household_id', householdId)
      .gte('occurred_at', start)
      .lte('occurred_at', end)
      .order('occurred_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch expenses: ${error.message}`)
    return ((data ?? []) as unknown as ExpenseRow[]).map(rowToExpense)
  }

  async save(expense: Expense): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('expenses').upsert({
      id: expense.id,
      household_id: expense.householdId,
      paid_by: expense.paidBy,
      category_id: expense.categoryId,
      occurred_at: expense.occurredAt.toISOString().split('T')[0]!,
      amount_cents: expense.amount.cents,
      description: expense.description,
      split_rule_type: expense.splitRule.type,
      split_rule_payer_percent: expense.splitRule.payerPercent ?? null,
      source_id: expense.sourceId,
      external_id: expense.externalId,
      imported_at: expense.importedAt.toISOString(),
    })

    if (error) throw new Error(`Failed to save expense: ${error.message}`)
  }

  async delete(id: ExpenseId): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete expense: ${error.message}`)
  }
}

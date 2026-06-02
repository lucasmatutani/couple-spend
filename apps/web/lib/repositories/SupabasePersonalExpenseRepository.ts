import { createClient } from '@/lib/supabase/server'
import {
  Money,
  PersonalExpense,
  toCategoryId,
  toPersonalExpenseId,
  toUserId,
  type PaymentMethod,
  type PersonalExpenseId,
  type PersonalExpenseRepository,
  type UserId,
  type YearMonth,
} from '@splitwise/domain'

export class SupabasePersonalExpenseRepository implements PersonalExpenseRepository {
  // RLS on personal_expenses uses owner_id = auth.uid().

  async findByOwnerAndMonth(_ownerId: UserId, month: YearMonth): Promise<PersonalExpense[]> {
    const supabase = await createClient()
    const start = month.startDate().toISOString().split('T')[0]!
    const end = month.endDate().toISOString().split('T')[0]!

    const { data, error } = await supabase
      .from('personal_expenses')
      .select('*')
      .gte('occurred_at', start)
      .lte('occurred_at', end)

    if (error) throw new Error(`Failed to fetch personal expenses: ${error.message}`)
    return (data ?? []).map((row) =>
      PersonalExpense.create({
        id: toPersonalExpenseId(row.id),
        ownerId: toUserId(row.owner_id),
        categoryId: toCategoryId(row.category_id),
        occurredAt: new Date(row.occurred_at),
        amount: Money.of(row.amount_cents),
        description: row.description,
        sourceId: row.source_id,
        externalId: row.external_id,
        importedAt: new Date(row.imported_at),
        paymentMethod: (row as Record<string, unknown>)['payment_method'] as PaymentMethod | null ?? null,
        splitParts: (row as Record<string, unknown>)['split_parts'] as number ?? 1,
        reimbursed: (row as Record<string, unknown>)['reimbursed'] as boolean ?? false,
        splitWithPartner: (row as Record<string, unknown>)['split_with_partner'] as boolean ?? false,
      }),
    )
  }

  async save(expense: PersonalExpense): Promise<void> {
    const supabase = await createClient()
    // payment_method is a new column not yet in generated types — cast as never until pnpm gen:types runs
    const { error } = await supabase.from('personal_expenses').upsert({
      id: expense.id,
      owner_id: expense.ownerId,
      category_id: expense.categoryId,
      occurred_at: expense.occurredAt.toISOString().split('T')[0]!,
      amount_cents: expense.amount.cents,
      description: expense.description,
      source_id: expense.sourceId,
      external_id: expense.externalId,
      payment_method: expense.paymentMethod,
      reimbursed: expense.reimbursed,
      split_with_partner: expense.splitWithPartner,
    } as never)
    if (error) throw new Error(`Failed to save personal expense: ${error.message}`)
  }

  async delete(id: PersonalExpenseId): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('personal_expenses').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete personal expense: ${error.message}`)
  }
}

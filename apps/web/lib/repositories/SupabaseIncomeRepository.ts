import { createClient } from '@/lib/supabase/server'
import {
  Income,
  Money,
  toIncomeId,
  toUserId,
  type IncomeRepository,
  type UserId,
  type YearMonth,
} from '@splitwise/domain'

export class SupabaseIncomeRepository implements IncomeRepository {
  // RLS on incomes uses owner_id = auth.uid().

  async findByOwnerAndMonth(_ownerId: UserId, month: YearMonth): Promise<Income[]> {
    const supabase = await createClient()
    const start = month.startDate().toISOString().split('T')[0]!
    const end = month.endDate().toISOString().split('T')[0]!

    const { data, error } = await supabase
      .from('incomes')
      .select('*')
      .gte('occurred_at', start)
      .lte('occurred_at', end)

    if (error) throw new Error(`Failed to fetch incomes: ${error.message}`)
    return (data ?? []).map((row) =>
      Income.create({
        id: toIncomeId(row.id),
        ownerId: toUserId(row.owner_id),
        occurredAt: new Date(row.occurred_at),
        amount: Money.of(row.amount_cents),
        source: row.source,
        recurring: row.recurring,
        createdAt: new Date(row.created_at),
      }),
    )
  }
}

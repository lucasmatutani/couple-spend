import { createClient } from '@/lib/supabase/server'
import {
  Investment,
  Money,
  toInvestmentId,
  toUserId,
  type InvestmentRepository,
  type UserId,
  type YearMonth,
} from '@splitwise/domain'

export class SupabaseInvestmentRepository implements InvestmentRepository {
  // RLS on investments uses owner_id = auth.uid().

  async findByOwnerAndMonth(_ownerId: UserId, month: YearMonth): Promise<Investment[]> {
    const supabase = await createClient()
    const start = month.startDate().toISOString().split('T')[0]!
    const end = month.endDate().toISOString().split('T')[0]!

    const { data, error } = await supabase
      .from('investments')
      .select('*')
      .gte('occurred_at', start)
      .lte('occurred_at', end)

    if (error) throw new Error(`Failed to fetch investments: ${error.message}`)
    return (data ?? []).map((row) =>
      Investment.create({
        id: toInvestmentId(row.id),
        ownerId: toUserId(row.owner_id),
        occurredAt: new Date(row.occurred_at),
        amount: Money.of(row.amount_cents),
        assetClass: row.asset_class,
        description: row.description,
        createdAt: new Date(row.created_at),
      }),
    )
  }
}

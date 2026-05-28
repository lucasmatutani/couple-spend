import { createClient } from '@/lib/supabase/server'
import {
  Investment,
  Money,
  toInvestmentId,
  toUserId,
  type InvestmentId,
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

  async save(investment: Investment): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('investments').upsert({
      id: investment.id,
      owner_id: investment.ownerId,
      occurred_at: investment.occurredAt.toISOString().split('T')[0]!,
      amount_cents: investment.amount.cents,
      asset_class: investment.assetClass,
      description: investment.description,
    })
    if (error) throw new Error(`Failed to save investment: ${error.message}`)
  }

  async delete(id: InvestmentId): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('investments').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete investment: ${error.message}`)
  }
}

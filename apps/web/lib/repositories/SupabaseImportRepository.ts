import { createClient } from '@/lib/supabase/server'
import type { ImportedTransaction, TransactionRepository } from '@splitwise/import-core'

export class SupabaseImportRepository implements TransactionRepository {
  async existsByExternalId(
    externalId: string,
    sourceId: string,
    householdId: string,
  ): Promise<boolean> {
    const supabase = await createClient()

    // Check shared expenses (household scope)
    const { count: expenseCount } = await supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .eq('source_id', sourceId)
      .eq('external_id', externalId)

    if ((expenseCount ?? 0) > 0) return true

    // Check personal expenses (owner scope — RLS applies auth.uid())
    const { count: personalCount } = await supabase
      .from('personal_expenses')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', sourceId)
      .eq('external_id', externalId)

    return (personalCount ?? 0) > 0
  }

  async saveBatch(transactions: ImportedTransaction[]): Promise<void> {
    if (transactions.length === 0) return

    const supabase = await createClient()

    const rows = transactions.map((t) => ({
      id: crypto.randomUUID(),
      household_id: t.householdId,
      paid_by: t.ownerId,
      category_id: t.categoryId,
      occurred_at: t.raw.occurredAt.toISOString().split('T')[0]!,
      amount_cents: Math.abs(t.raw.amountCents),
      description: t.raw.description || null,
      split_rule_type: t.splitRule,
      split_rule_payer_percent: null as number | null,
      source_id: t.sourceId,
      external_id: t.raw.externalId,
      imported_at: t.importedAt.toISOString(),
    }))

    const { error } = await supabase.from('expenses').upsert(rows, {
      onConflict: 'household_id,source_id,external_id',
      ignoreDuplicates: true,
    })

    if (error) throw new Error(`Failed to save imported transactions: ${error.message}`)
  }
}

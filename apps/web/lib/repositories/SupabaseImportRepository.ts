import { createClient } from '@/lib/supabase/server'
import type { ImportedTransaction, TransactionRepository } from '@splitwise/import-core'

export class SupabaseImportRepository implements TransactionRepository {
  async existsByExternalId(
    externalId: string,
    sourceId: string,
    householdId: string,
  ): Promise<boolean> {
    const supabase = await createClient()

    // PDF invoice imports live in personal_expenses — skip the shared expenses check.
    if (sourceId !== 'pdf-invoice') {
      const { count: expenseCount } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', householdId)
        .eq('source_id', sourceId)
        .eq('external_id', externalId)

      if ((expenseCount ?? 0) > 0) return true
    }

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

  async savePersonalBatch(
    transactions: ImportedTransaction[],
    paymentMethod: 'credit_card' | 'debit' | 'pix' | 'cash' | 'other',
    billingOccurredAt: string,
  ): Promise<void> {
    if (transactions.length === 0) return

    const supabase = await createClient()

    const externalIds = transactions.map((t) => t.raw.externalId)
    const sourceId = transactions[0]!.sourceId

    // Remove stale records from both tables so re-imports always use the correct billing month.
    await Promise.all([
      supabase.from('expenses').delete().eq('source_id', sourceId).in('external_id', externalIds),
      supabase.from('personal_expenses').delete().eq('source_id', sourceId).in('external_id', externalIds),
    ])

    const rows = transactions.map((t) => ({
      id: crypto.randomUUID(),
      owner_id: t.ownerId,
      category_id: t.categoryId,
      occurred_at: billingOccurredAt,
      amount_cents: Math.abs(t.raw.amountCents),
      description: t.raw.description || null,
      source_id: t.sourceId,
      external_id: t.raw.externalId,
      imported_at: t.importedAt.toISOString(),
      payment_method: paymentMethod,
    }))

    const { error } = await supabase.from('personal_expenses').upsert(rows as never, {
      onConflict: 'owner_id,source_id,external_id',
      ignoreDuplicates: true,
    })

    if (error) throw new Error(`Failed to save personal imported transactions: ${error.message}`)
  }
}

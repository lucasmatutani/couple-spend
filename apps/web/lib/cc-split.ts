import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A credit-card personal expense marked "split with partner" is mirrored into the
 * household `expenses` table (full amount, EQUAL split) so the payer's outlay and
 * the household balance stay correct — memberCount drives the per-person fraction,
 * not a hardcoded 0.5. Linked via source_id 'cc-split' + external_id = personal_expense.id.
 */
const CC_SPLIT_SOURCE_ID = 'cc-split'

export async function upsertCreditCardHouseholdSplit(
  supabase: SupabaseClient,
  params: {
    personalExpenseId: string
    householdId: string
    paidBy: string
    categoryId: string
    occurredAt: string
    amountCents: number
    description: string | null
  },
): Promise<void> {
  const { personalExpenseId, householdId, paidBy, categoryId, occurredAt, amountCents, description } = params

  await supabase.from('expenses').upsert(
    {
      id: crypto.randomUUID(),
      household_id: householdId,
      paid_by: paidBy,
      category_id: categoryId,
      occurred_at: occurredAt,
      amount_cents: amountCents,
      description,
      split_rule_type: 'EQUAL' as const,
      split_rule_payer_percent: null,
      source_id: CC_SPLIT_SOURCE_ID,
      external_id: personalExpenseId,
      imported_at: new Date().toISOString(),
    },
    { onConflict: 'household_id,source_id,external_id' },
  )
}

export async function removeCreditCardHouseholdSplit(
  supabase: SupabaseClient,
  householdId: string,
  personalExpenseId: string,
): Promise<void> {
  await supabase
    .from('expenses')
    .delete()
    .eq('household_id', householdId)
    .eq('source_id', CC_SPLIT_SOURCE_ID)
    .eq('external_id', personalExpenseId)
}

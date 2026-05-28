import { createClient } from '@/lib/supabase/server'
import {
  toCategoryId,
  toHouseholdId,
  type CategoryId,
  type CategoryRepository,
  type CategoryRow,
  type HouseholdId,
} from '@splitwise/domain'

export class SupabaseCategoryRepository implements CategoryRepository {
  // RLS returns global templates (household_id IS NULL) and household-specific categories.

  async findAll(householdId: HouseholdId): Promise<CategoryRow[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .or(`household_id.is.null,household_id.eq.${householdId}`)
      .order('name')

    if (error) throw new Error(`Failed to fetch categories: ${error.message}`)
    return (data ?? []).map((row) => ({
      id: toCategoryId(row.id),
      name: row.name,
      budgetBucket: row.budget_bucket,
      defaultSplitRule: row.default_split_rule,
      householdId: row.household_id ? toHouseholdId(row.household_id) : null,
    }))
  }

  async findById(id: CategoryId): Promise<CategoryRow | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error ?? !data) return null
    return {
      id: toCategoryId(data.id),
      name: data.name,
      budgetBucket: data.budget_bucket,
      defaultSplitRule: data.default_split_rule,
      householdId: data.household_id ? toHouseholdId(data.household_id) : null,
    }
  }
}

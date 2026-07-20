import { createClient } from '@/lib/supabase/server'
import {
  toCategoryId,
  toHouseholdId,
  type CategoryId,
  type CategoryRepository,
  type CategoryRow,
  type CategoryUpdateInput,
  type HouseholdId,
  type NewCategoryInput,
} from '@splitwise/domain'

type CategoryTableRow = {
  id: string
  name: string
  household_id: string | null
  keywords_hint: string | null
}

function toCategoryRow(row: CategoryTableRow): CategoryRow {
  return {
    id: toCategoryId(row.id),
    name: row.name,
    householdId: row.household_id ? toHouseholdId(row.household_id) : null,
    keywordsHint: row.keywords_hint,
  }
}

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
    return (data ?? []).map((row) => toCategoryRow(row as CategoryTableRow))
  }

  async findById(id: CategoryId): Promise<CategoryRow | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error ?? !data) return null
    return toCategoryRow(data as CategoryTableRow)
  }

  // RLS (categories_insert) restricts this to the household owner — see ADR/CLAUDE.md §4.2.
  async create(input: NewCategoryInput): Promise<CategoryRow> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categories')
      .insert({
        household_id: input.householdId,
        name: input.name,
        keywords_hint: input.keywordsHint,
        is_template: false,
      })
      .select('*')
      .single()

    if (error) throw new Error(`Failed to create category: ${error.message}`)
    return toCategoryRow(data as CategoryTableRow)
  }

  // RLS (categories_update) restricts this to the household owner.
  async update(id: CategoryId, input: CategoryUpdateInput): Promise<CategoryRow> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('categories')
      .update({
        name: input.name,
        keywords_hint: input.keywordsHint,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw new Error(`Failed to update category: ${error.message}`)
    return toCategoryRow(data as CategoryTableRow)
  }

  // RLS (categories_delete) restricts this to the household owner. A category still
  // referenced by expenses/personal_expenses/recurring_expenses/category_memory fails
  // with a foreign-key violation (no ON DELETE CASCADE) — callers should surface that
  // as "category still in use" rather than a generic error.
  async delete(id: CategoryId): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('categories').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete category: ${error.message}`)
  }
}

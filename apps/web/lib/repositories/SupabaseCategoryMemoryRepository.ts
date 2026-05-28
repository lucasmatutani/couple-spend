import { createClient } from '@/lib/supabase/server'
import type { CategoryMemoryEntry, CategoryMemoryRepository, CategoryMemoryRow } from '@splitwise/categorization'

export class SupabaseCategoryMemoryRepository implements CategoryMemoryRepository {
  async findByPattern(householdId: string, ownerId: string, pattern: string): Promise<CategoryMemoryRow | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('category_memory')
      .select('*')
      .eq('household_id', householdId)
      .eq('owner_id', ownerId)
      .ilike('description_pattern', pattern)
      .maybeSingle()

    if (error ?? !data) return null
    return {
      id: data.id,
      householdId: data.household_id,
      ownerId: data.owner_id,
      descriptionPattern: data.description_pattern,
      categoryId: data.category_id,
      confidence: Number(data.confidence),
    }
  }

  async save(entry: CategoryMemoryEntry): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('category_memory').upsert(
      {
        household_id: entry.householdId,
        owner_id: entry.ownerId,
        description_pattern: entry.descriptionPattern,
        category_id: entry.categoryId,
        confidence: entry.confidence,
      },
      { onConflict: 'household_id,owner_id,description_pattern' },
    )
    if (error) throw new Error(`Failed to save category memory: ${error.message}`)
  }
}

export type CategoryMemoryRow = {
  id: string
  householdId: string
  ownerId: string
  descriptionPattern: string
  categoryId: string
  confidence: number
}

export type CategoryMemoryEntry = {
  householdId: string
  ownerId: string
  descriptionPattern: string
  categoryId: string
  confidence: number
}

export interface CategoryMemoryRepository {
  findByPattern(householdId: string, ownerId: string, pattern: string): Promise<CategoryMemoryRow | null>
  save(entry: CategoryMemoryEntry): Promise<void>
}

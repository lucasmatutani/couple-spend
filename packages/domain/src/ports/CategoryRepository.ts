import { type CategoryId, type HouseholdId } from '../kernel/ids.js'

export type CategoryRow = {
  id: CategoryId
  name: string
  householdId: HouseholdId | null
  keywordsHint: string | null
}

export type NewCategoryInput = {
  householdId: HouseholdId
  name: string
  keywordsHint: string | null
}

export type CategoryUpdateInput = {
  name: string
  keywordsHint: string | null
}

export interface CategoryRepository {
  findAll(householdId: HouseholdId): Promise<CategoryRow[]>
  findById(id: CategoryId): Promise<CategoryRow | null>
  create(input: NewCategoryInput): Promise<CategoryRow>
  update(id: CategoryId, input: CategoryUpdateInput): Promise<CategoryRow>
  delete(id: CategoryId): Promise<void>
}

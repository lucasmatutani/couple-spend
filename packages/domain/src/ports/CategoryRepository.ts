import { type CategoryId, type HouseholdId } from '../kernel/ids.js'

export type CategoryRow = {
  id: CategoryId
  name: string
  budgetBucket: 'needs' | 'wants' | 'savings'
  defaultSplitRule: 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM'
  householdId: HouseholdId | null
}

export type NewCategoryInput = {
  householdId: HouseholdId
  name: string
  budgetBucket: 'needs' | 'wants' | 'savings'
  defaultSplitRule: 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM'
}

export interface CategoryRepository {
  findAll(householdId: HouseholdId): Promise<CategoryRow[]>
  findById(id: CategoryId): Promise<CategoryRow | null>
  create(input: NewCategoryInput): Promise<CategoryRow>
}

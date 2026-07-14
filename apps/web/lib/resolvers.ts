import {
  ChainCategoryResolver,
  DEFAULT_RULES,
  DefaultResolver,
  RuleBasedResolver,
  UserMemoryResolver,
} from '@splitwise/categorization'
import type { CategoryResolver } from '@splitwise/import-core'
import type { CategoryId, HouseholdId, UserId } from '@splitwise/domain'
import { SupabaseCategoryRepository } from './repositories/SupabaseCategoryRepository'
import { SupabaseCategoryMemoryRepository } from './repositories/SupabaseCategoryMemoryRepository'

export async function buildCategoryResolver(
  householdId: HouseholdId,
  ownerId: UserId,
  otherCategoryId: CategoryId,
): Promise<CategoryResolver> {
  const categories = await new SupabaseCategoryRepository().findAll(householdId)
  const nameToId = new Map(categories.map((c) => [c.name, c.id as string]))

  const resolvedRules = DEFAULT_RULES.map((r) => ({
    ...r,
    categoryId: nameToId.get(r.categoryId) ?? r.categoryId,
  }))

  return new ChainCategoryResolver([
    // User corrections must outrank generic keyword rules — otherwise a rule match
    // (confidence 1.0) always shadows a memorized correction for the same merchant.
    new UserMemoryResolver(new SupabaseCategoryMemoryRepository(), householdId as string, ownerId as string),
    new RuleBasedResolver(resolvedRules),
    new DefaultResolver(otherCategoryId as string),
  ])
}

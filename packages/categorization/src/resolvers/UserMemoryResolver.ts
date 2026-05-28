import type { CategoryResolution, RawTransaction } from '@splitwise/import-core'
import type { CategoryMemoryRepository } from '../ports/CategoryMemoryRepository.js'
import type { CategoryResolverChainLink } from './CategoryResolverChainLink.js'

export class UserMemoryResolver implements CategoryResolverChainLink {
  constructor(
    private readonly memoryRepo: CategoryMemoryRepository,
    private readonly householdId: string,
    private readonly ownerId: string,
  ) {}

  async resolve(raw: RawTransaction): Promise<CategoryResolution | null> {
    const row = await this.memoryRepo.findByPattern(this.householdId, this.ownerId, raw.description)
    if (!row) return null
    return { categoryId: row.categoryId, confidence: row.confidence, source: 'memory' }
  }
}

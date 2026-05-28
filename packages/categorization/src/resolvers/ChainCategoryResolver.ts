import type { CategoryResolution, CategoryResolver, RawTransaction } from '@splitwise/import-core'
import type { CategoryResolverChainLink } from './CategoryResolverChainLink.js'

export class ChainCategoryResolver implements CategoryResolver {
  constructor(
    private readonly links: CategoryResolverChainLink[],
    private readonly threshold = 0.7,
  ) {}

  async resolve(raw: RawTransaction): Promise<CategoryResolution> {
    let lastNonNull: CategoryResolution | null = null

    for (const link of this.links) {
      const result = await link.resolve(raw)
      if (result !== null) {
        lastNonNull = result
        if (result.confidence >= this.threshold) return result
      }
    }

    return lastNonNull ?? { categoryId: 'other', confidence: 0, source: 'default' }
  }
}

import type { CategoryResolution, RawTransaction } from '@splitwise/import-core'
import type { CategoryResolverChainLink } from './CategoryResolverChainLink.js'

export class DefaultResolver implements CategoryResolverChainLink {
  constructor(private readonly otherCategoryId: string) {}

  async resolve(_raw: RawTransaction): Promise<CategoryResolution> {
    return { categoryId: this.otherCategoryId, confidence: 0, source: 'default' }
  }
}

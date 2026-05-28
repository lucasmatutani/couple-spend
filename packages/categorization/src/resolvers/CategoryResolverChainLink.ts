import type { CategoryResolution } from '@splitwise/import-core'
import type { RawTransaction } from '@splitwise/import-core'

export interface CategoryResolverChainLink {
  resolve(raw: RawTransaction): Promise<CategoryResolution | null>
}

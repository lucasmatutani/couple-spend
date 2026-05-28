import type { RawTransaction } from '../RawTransaction.js'

export interface CategoryResolution {
  categoryId: string
  confidence: number // 0..1
  source: 'rule' | 'memory' | 'llm' | 'default'
}

export interface CategoryResolver {
  resolve(raw: RawTransaction): Promise<CategoryResolution>
}

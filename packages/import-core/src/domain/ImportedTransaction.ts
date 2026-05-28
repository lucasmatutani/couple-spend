import type { RawTransaction } from './RawTransaction.js'
import type { SplitRuleType } from './ports/SplitRulePolicy.js'

export type ImportedTransaction = {
  ownerId: string
  householdId: string
  sourceId: string
  raw: RawTransaction
  categoryId: string
  categoryConfidence: number
  categorySource: 'rule' | 'memory' | 'llm' | 'default'
  splitRule: SplitRuleType
  importedAt: Date
}

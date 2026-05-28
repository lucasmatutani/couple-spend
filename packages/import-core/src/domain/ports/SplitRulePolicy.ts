// Local definition — import-core does not depend on @splitwise/domain.
export type SplitRuleType = 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM'

export interface SplitRulePolicy {
  apply(categoryId: string): SplitRuleType
}

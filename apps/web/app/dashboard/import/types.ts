import type { ImportedTransaction } from '@splitwise/import-core'

export type ImportPreview = {
  transactions: ImportedTransaction[]
  warnings: string[]
  householdId: string
}

export type ReviewRow = {
  idx: number
  externalId: string
  occurredAt: string
  description: string
  amountFormatted: string
  amountCents: number
  categoryId: string
  categoryConfidence: number
  categorySource: 'rule' | 'memory' | 'llm' | 'default'
  splitRule: string
  excluded: boolean
  sourceId: string
  installment?: { current: number; total: number } | null
}

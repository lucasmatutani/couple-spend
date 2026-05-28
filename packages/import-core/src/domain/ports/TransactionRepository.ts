import type { ImportedTransaction } from '../ImportedTransaction.js'

export interface TransactionRepository {
  existsByExternalId(externalId: string, sourceId: string, householdId: string): Promise<boolean>
  saveBatch(transactions: ImportedTransaction[]): Promise<void>
}

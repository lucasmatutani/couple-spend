import type { ImportedTransaction } from '../domain/ImportedTransaction.js'
import type { CategoryResolver } from '../domain/ports/CategoryResolver.js'
import type { Clock } from '../domain/ports/Clock.js'
import type { SplitRulePolicy } from '../domain/ports/SplitRulePolicy.js'
import type { FetchParams, TransactionSource } from '../domain/ports/TransactionSource.js'
import type { TransactionRepository } from '../domain/ports/TransactionRepository.js'

export type ImportSummary = {
  sourceId: string
  effectiveRange: { from: Date; to: Date }
  total: number
  imported: number
  skipped: number
  lowConfidence: number
  warnings: string[]
  /** Full list of imported transactions, available for review UI before confirming. */
  importedTransactions: ImportedTransaction[]
}

export class ImportTransactionsUseCase {
  constructor(
    private readonly repository: TransactionRepository,
    private readonly resolver: CategoryResolver,
    private readonly splitPolicy: SplitRulePolicy,
    private readonly clock: Clock,
  ) {}

  async execute(
    source: TransactionSource,
    params: FetchParams,
    ownerId: string,
    householdId: string,
  ): Promise<ImportSummary> {
    const result = await source.fetch(params)

    const imported: ImportedTransaction[] = []
    let skipped = 0

    for (const raw of result.transactions) {
      const isDuplicate = await this.repository.existsByExternalId(raw.externalId, source.id, householdId)
      if (isDuplicate) {
        skipped++
        continue
      }

      const resolution = await this.resolver.resolve(raw)
      const splitRule = this.splitPolicy.apply(resolution.categoryId)

      imported.push({
        ownerId,
        householdId,
        sourceId: source.id,
        raw,
        categoryId: resolution.categoryId,
        categoryConfidence: resolution.confidence,
        categorySource: resolution.source,
        splitRule,
        importedAt: this.clock.now(),
      })
    }

    await this.repository.saveBatch(imported)

    return {
      sourceId: source.id,
      effectiveRange: result.effectiveRange,
      total: result.transactions.length,
      imported: imported.length,
      skipped,
      lowConfidence: imported.filter((t) => t.categoryConfidence < 0.7).length,
      warnings: result.warnings,
      importedTransactions: imported,
    }
  }
}

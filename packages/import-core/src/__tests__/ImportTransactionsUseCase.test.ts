import { describe, it, expect, vi } from 'vitest'
import { ImportTransactionsUseCase } from '../application/ImportTransactionsUseCase.js'
import type { RawTransaction } from '../domain/RawTransaction.js'
import type { CategoryResolver } from '../domain/ports/CategoryResolver.js'
import type { Clock } from '../domain/ports/Clock.js'
import type { SplitRulePolicy } from '../domain/ports/SplitRulePolicy.js'
import type { FetchResult, TransactionSource } from '../domain/ports/TransactionSource.js'
import type { TransactionRepository } from '../domain/ports/TransactionRepository.js'

function makeRaw(id: string): RawTransaction {
  return {
    externalId: id,
    occurredAt: new Date('2024-01-15'),
    amountCents: 10000,
    description: `Transaction ${id}`,
    currency: 'BRL',
    sourceInstitution: 'TestBank',
  }
}

function makeSource(transactions: RawTransaction[]): TransactionSource {
  const result: FetchResult = {
    transactions,
    effectiveRange: { from: new Date('2024-01-01'), to: new Date('2024-01-31') },
    warnings: [],
  }
  return {
    id: 'test-source',
    displayName: 'Test Source',
    fetch: async () => result,
  }
}

function makeRepo(existingIds: Set<string> = new Set()): TransactionRepository {
  return {
    existsByExternalId: async (externalId) => existingIds.has(externalId),
    saveBatch: vi.fn().mockResolvedValue(undefined),
  }
}

const defaultResolver: CategoryResolver = {
  resolve: async () => ({ categoryId: 'cat-default', confidence: 0.9, source: 'default' }),
}

const lowConfidenceResolver: CategoryResolver = {
  resolve: async () => ({ categoryId: 'cat-default', confidence: 0.3, source: 'default' }),
}

const defaultPolicy: SplitRulePolicy = { apply: () => 'EQUAL' }

const fixedClock: Clock = { now: () => new Date('2024-02-01') }

describe('ImportTransactionsUseCase', () => {
  it('5 new transactions → 5 imported, 0 skipped', async () => {
    const txs = Array.from({ length: 5 }, (_, i) => makeRaw(`tx-${i}`))
    const repo = makeRepo()
    const uc = new ImportTransactionsUseCase(repo, defaultResolver, defaultPolicy, fixedClock)

    const summary = await uc.execute(makeSource(txs), {}, 'owner-1', 'household-1')

    expect(summary.total).toBe(5)
    expect(summary.imported).toBe(5)
    expect(summary.skipped).toBe(0)
    expect(summary.importedTransactions).toHaveLength(5)
    expect(repo.saveBatch).toHaveBeenCalledOnce()
  })

  it('3 new + 2 duplicates → 3 imported, 2 skipped', async () => {
    const txs = Array.from({ length: 5 }, (_, i) => makeRaw(`tx-${i}`))
    // tx-0 and tx-1 already exist
    const existingIds = new Set(['tx-0', 'tx-1'])
    const repo = makeRepo(existingIds)
    const uc = new ImportTransactionsUseCase(repo, defaultResolver, defaultPolicy, fixedClock)

    const summary = await uc.execute(makeSource(txs), {}, 'owner-1', 'household-1')

    expect(summary.imported).toBe(3)
    expect(summary.skipped).toBe(2)
    expect(summary.importedTransactions).toHaveLength(3)
  })

  it('1 transaction with confidence 0.3 → counted in lowConfidence', async () => {
    const txs = [makeRaw('tx-low')]
    const repo = makeRepo()
    const uc = new ImportTransactionsUseCase(repo, lowConfidenceResolver, defaultPolicy, fixedClock)

    const summary = await uc.execute(makeSource(txs), {}, 'owner-1', 'household-1')

    expect(summary.imported).toBe(1)
    expect(summary.lowConfidence).toBe(1)
    expect(summary.importedTransactions[0]!.categoryConfidence).toBe(0.3)
  })
})

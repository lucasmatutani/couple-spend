import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PluggyAdapter } from '../PluggyAdapter.js'
import { TransactionSourceUnavailableError } from '@splitwise/import-core'
import type { PluggyClient, Transaction as PluggyTransaction, PageResponse, Account, CursorPageResponse } from 'pluggy-sdk'

function makeTx(id: string, amount: number, type: 'CREDIT' | 'DEBIT' = 'DEBIT'): PluggyTransaction {
  return {
    id,
    accountId: 'acc-1',
    date: new Date('2026-01-15'),
    description: `Transaction ${id}`,
    descriptionRaw: null,
    type,
    amount,
    amountInAccountCurrency: null,
    balance: 0,
    currencyCode: 'BRL',
    category: null,
    creditCardMetadata: null,
    operationType: null,
    providerId: null,
    categoryId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as PluggyTransaction
}

function makePage(
  count: number,
  startIdx: number,
  next: string | null,
): CursorPageResponse<PluggyTransaction> {
  return {
    results: Array.from({ length: count }, (_, i) => makeTx(`tx-${startIdx + i}`, 50, 'DEBIT')),
    next,
  }
}

function makeAccountsPage(accountIds: string[]): PageResponse<Account> {
  return {
    results: accountIds.map((id) => ({ id } as Account)),
    page: 1,
    total: accountIds.length,
    totalPages: 1,
  }
}

function makeClient(overrides: Partial<Pick<PluggyClient, 'fetchAccounts' | 'fetchTransactionsCursor'>>): PluggyClient {
  return {
    fetchAccounts: vi.fn().mockResolvedValue(makeAccountsPage(['acc-1'])),
    fetchTransactionsCursor: vi.fn().mockResolvedValue({ results: [], next: null }),
    ...overrides,
  } as unknown as PluggyClient
}

describe('PluggyAdapter', () => {
  it('3 pages of 20 transactions → 60 RawTransactions', async () => {
    const client = makeClient({
      fetchTransactionsCursor: vi.fn()
        .mockResolvedValueOnce(makePage(20, 0, 'cursor1'))
        .mockResolvedValueOnce(makePage(20, 20, 'cursor2'))
        .mockResolvedValueOnce(makePage(20, 40, null)),
    })
    const adapter = new PluggyAdapter(client, 'item-1', 'BankCo')
    const result = await adapter.fetch({})
    expect(result.transactions).toHaveLength(60)
  })

  it('Pluggy positive amount (CREDIT) → negative amountCents (income inversion)', async () => {
    const client = makeClient({
      fetchTransactionsCursor: vi.fn().mockResolvedValue({
        results: [makeTx('t1', 100, 'CREDIT')],
        next: null,
      }),
    })
    const adapter = new PluggyAdapter(client, 'item-1', 'BankCo')
    const result = await adapter.fetch({})
    expect(result.transactions[0]!.amountCents).toBe(-10000)
  })

  it('Pluggy negative amount (DEBIT) → positive amountCents (expense inversion)', async () => {
    const client = makeClient({
      fetchTransactionsCursor: vi.fn().mockResolvedValue({
        results: [makeTx('t1', -50, 'DEBIT')],
        next: null,
      }),
    })
    const adapter = new PluggyAdapter(client, 'item-1', 'BankCo')
    const result = await adapter.fetch({})
    expect(result.transactions[0]!.amountCents).toBe(5000)
  })

  describe('retry behavior', () => {
    beforeEach(() => { vi.useFakeTimers() })
    afterEach(() => { vi.useRealTimers() })

    it('2 failures then success → returns result (retry works)', async () => {
      const fetchAccounts = vi.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue(makeAccountsPage(['acc-1']))

      const client = makeClient({ fetchAccounts })
      const adapter = new PluggyAdapter(client, 'item-1', 'BankCo')

      const promise = adapter.fetch({})
      await vi.runAllTimersAsync()
      const result = await promise

      expect(fetchAccounts).toHaveBeenCalledTimes(3)
      expect(result.transactions).toHaveLength(0)
    })

    it('3 failures → throws TransactionSourceUnavailableError', async () => {
      const client = makeClient({
        fetchAccounts: vi.fn().mockRejectedValue(new Error('persistent failure')),
      })
      const adapter = new PluggyAdapter(client, 'item-1', 'BankCo')

      // Attach catch immediately to prevent vitest from treating it as unhandled during timer advancing
      const captured = adapter.fetch({}).catch((e: unknown) => e)
      await vi.runAllTimersAsync()
      const result = await captured
      expect(result).toBeInstanceOf(TransactionSourceUnavailableError)
    })
  })

  it('same Pluggy response → identical externalIds (determinism)', async () => {
    const tx = makeTx('stable-id-123', 25, 'DEBIT')
    const client = makeClient({
      fetchTransactionsCursor: vi.fn().mockResolvedValue({ results: [tx], next: null }),
    })

    const adapter1 = new PluggyAdapter(client, 'item-1', 'BankCo')
    const adapter2 = new PluggyAdapter(client, 'item-1', 'BankCo')

    const r1 = await adapter1.fetch({})
    const r2 = await adapter2.fetch({})

    expect(r1.transactions[0]!.externalId).toBe(r2.transactions[0]!.externalId)
    expect(r1.transactions[0]!.externalId).toBe('stable-id-123')
  })
})

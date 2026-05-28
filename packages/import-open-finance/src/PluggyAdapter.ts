import type { PluggyClient, Transaction as PluggyTransaction } from 'pluggy-sdk'
import type { FetchParams, FetchResult, RawTransaction, TransactionSource } from '@splitwise/import-core'
import { TransactionSourceUnavailableError } from '@splitwise/import-core'

export class PluggyAdapter implements TransactionSource {
  readonly id = 'open-finance-pluggy'
  readonly displayName = 'Open Finance'

  constructor(
    private readonly pluggyClient: PluggyClient,
    private readonly itemId: string,
    private readonly institutionName: string,
  ) {}

  async fetch(params: FetchParams): Promise<FetchResult> {
    const dateFrom = params.dateRange?.from.toISOString().split('T')[0]
    const dateTo = params.dateRange?.to.toISOString().split('T')[0]

    const accountsPage = await this.withRetry(() =>
      this.pluggyClient.fetchAccounts(this.itemId),
    )

    const allTransactions: PluggyTransaction[] = []

    for (const account of accountsPage.results) {
      let cursor: string | undefined = undefined
      do {
        const filters: Parameters<typeof this.pluggyClient.fetchTransactionsCursor>[1] = {}
        if (dateFrom !== undefined) filters.dateFrom = dateFrom
        if (dateTo !== undefined) filters.dateTo = dateTo
        if (cursor !== undefined) filters.after = cursor
        const page = await this.withRetry(() =>
          this.pluggyClient.fetchTransactionsCursor(account.id, filters),
        )
        allTransactions.push(...page.results)
        cursor = page.next ?? undefined
      } while (cursor !== undefined)
    }

    const mapped = allTransactions.map((t) => this.toRaw(t))

    const dates = allTransactions.map((t) => new Date(t.date).getTime())
    const from = dates.length > 0
      ? new Date(Math.min(...dates))
      : (params.dateRange?.from ?? new Date())
    const to = dates.length > 0
      ? new Date(Math.max(...dates))
      : (params.dateRange?.to ?? new Date())

    return { transactions: mapped, effectiveRange: { from, to }, warnings: [] }
  }

  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: unknown
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn()
      } catch (err) {
        lastError = err
        if (attempt < maxAttempts - 1) {
          await new Promise<void>((resolve) =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt)),
          )
        }
      }
    }
    throw new TransactionSourceUnavailableError(this.id, lastError)
  }

  private toRaw(t: PluggyTransaction): RawTransaction {
    const absAmountCents = Math.round(Math.abs(t.amount) * 100)
    // Pluggy: CREDIT = inflow (income) → negative; DEBIT = outflow (expense) → positive
    const amountCents = t.type === 'CREDIT' ? -absAmountCents : absAmountCents
    return {
      externalId: t.id,
      occurredAt: new Date(t.date),
      amountCents,
      description: t.description,
      currency: 'BRL',
      sourceInstitution: this.institutionName,
      rawType: t.type === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      metadata: {
        pluggyAccountId: t.accountId,
        pluggyItemId: this.itemId,
      },
    }
  }
}

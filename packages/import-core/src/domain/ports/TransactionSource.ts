import type { RawTransaction } from '../RawTransaction.js'

export interface FetchParams {
  dateRange?: { from: Date; to: Date }
  limit?: number
}

export interface FetchResult {
  transactions: RawTransaction[]
  effectiveRange: { from: Date; to: Date }
  warnings: string[]
}

export interface TransactionSource {
  readonly id: string
  readonly displayName: string
  fetch(params: FetchParams): Promise<FetchResult>
}

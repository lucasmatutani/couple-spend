// packages/import-core/src/domain/RawTransaction.ts
export interface RawTransaction {
  /**
   * Unique, stable identifier of the transaction AT THE SOURCE.
   * - OFX: <FITID>
   * - CSV: deterministic hash of (date + amount + description)
   * - Open Finance: bank's transactionId
   * - Manual: generated uuid
   *
   * Used for deduplication. Adapter is responsible for ensuring
   * the same event always produces the same externalId.
   */
  externalId: string

  /** Transaction date (not settlement date). */
  occurredAt: Date

  /**
   * Amount in cents. Positive = outflow (expense), negative = inflow (income).
   * Expenses are the dominant case; positive outflow reduces sign manipulation
   * in domain code. See ADR-003.
   */
  amountCents: number

  /** Raw description from source. Do NOT normalize here. */
  description: string

  /** ISO 4217 currency. Always "BRL" in MVP, explicit for future use. */
  currency: 'BRL'

  /** Institution or source name. E.g. "Itaú", "PicPay", "Manual". */
  sourceInstitution: string

  /** Raw transaction type, if provided by source. Optional. */
  rawType?: 'DEBIT' | 'CREDIT' | 'PIX' | 'TRANSFER' | 'FEE' | 'OTHER'

  /** Source-specific metadata. Not used in domain — for audit/debug only. */
  metadata?: Record<string, unknown>
}

import { InvalidSplitRuleError } from './errors.js'

export type SplitRuleType = 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM'

export class SplitRule {
  /** payerPercent is only meaningful when type === 'CUSTOM'. */
  readonly payerPercent: number | undefined

  private constructor(
    readonly type: SplitRuleType,
    payerPercent: number | undefined,
  ) {
    this.payerPercent = payerPercent
  }

  static equal(): SplitRule {
    return new SplitRule('EQUAL', undefined)
  }

  static onlyPayer(): SplitRule {
    return new SplitRule('ONLY_PAYER', undefined)
  }

  static onlyOther(): SplitRule {
    return new SplitRule('ONLY_OTHER', undefined)
  }

  static custom(payerPercent: number): SplitRule {
    if (payerPercent < 0 || payerPercent > 100) {
      throw new InvalidSplitRuleError(
        `CUSTOM split payerPercent must be between 0 and 100, got ${payerPercent}.`,
      )
    }
    return new SplitRule('CUSTOM', payerPercent)
  }

  /**
   * Fraction of the expense amount owed by the payer.
   * Callers MUST pass the real household member count for EQUAL — never hardcode 2.
   */
  payerShare(memberCount = 2): number {
    switch (this.type) {
      case 'EQUAL':
        return 1 / memberCount
      case 'ONLY_PAYER':
        return 1.0
      case 'ONLY_OTHER':
        return 0.0
      case 'CUSTOM':
        // payerPercent is guaranteed non-null for CUSTOM by the static factory
        return this.payerPercent! / 100
    }
  }

  otherShare(memberCount = 2): number {
    // EQUAL: every member (payer included) owes 1/N — same formula as payerShare.
    // The generic (1 - payerShare) only holds for 2-person households.
    if (this.type === 'EQUAL') return 1 / memberCount
    return 1 - this.payerShare(memberCount)
  }
}

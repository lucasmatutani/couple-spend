import { Money } from '../kernel/Money.js'
import { type CategoryId, type ExpenseId, type HouseholdId, type UserId } from '../kernel/ids.js'
import { SplitRule } from '../SplitRule.js'
import { InvalidExpenseError } from '../errors.js'

export class Expense {
  private constructor(
    readonly id: ExpenseId,
    readonly householdId: HouseholdId,
    readonly paidBy: UserId,
    readonly categoryId: CategoryId,
    readonly occurredAt: Date,
    readonly amount: Money,
    readonly description: string | null,
    readonly splitRule: SplitRule,
    readonly sourceId: string,
    readonly externalId: string,
    readonly importedAt: Date,
  ) {}

  static create(data: {
    id: ExpenseId
    householdId: HouseholdId
    paidBy: UserId
    categoryId: CategoryId
    occurredAt: Date
    amount: Money
    description: string | null
    splitRule: SplitRule
    sourceId: string
    externalId: string
    importedAt?: Date
  }): Expense {
    if (!data.amount.isPositive()) {
      throw new InvalidExpenseError('Expense amount must be positive (amount_cents > 0).')
    }
    if (isNaN(data.occurredAt.getTime())) {
      throw new InvalidExpenseError('Expense occurredAt is not a valid Date.')
    }
    return new Expense(
      data.id,
      data.householdId,
      data.paidBy,
      data.categoryId,
      data.occurredAt,
      data.amount,
      data.description,
      data.splitRule,
      data.sourceId,
      data.externalId,
      data.importedAt ?? new Date(),
    )
  }

  /**
   * Returns how much of this expense userId owes.
   *
   * SPEC §10.1: the payer's share is splitRule.payerShare(), everyone else's
   * is splitRule.otherShare(). memberCount must be the real count of household
   * members — never hardcode 2 (CLAUDE.md §4.4).
   */
  owedBy(userId: UserId, memberCount: number): Money {
    const factor =
      userId === this.paidBy
        ? this.splitRule.payerShare(memberCount)
        : this.splitRule.otherShare(memberCount)
    return this.amount.multiply(factor)
  }
}

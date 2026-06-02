import { Money } from '../kernel/Money.js'
import {
  type CategoryId,
  type PersonalExpenseId,
  type UserId,
} from '../kernel/ids.js'

export type PaymentMethod = 'credit_card' | 'debit' | 'pix' | 'cash' | 'other'

export class PersonalExpense {
  private constructor(
    readonly id: PersonalExpenseId,
    readonly ownerId: UserId,
    readonly categoryId: CategoryId,
    readonly occurredAt: Date,
    readonly amount: Money,
    readonly description: string | null,
    readonly sourceId: string,
    readonly externalId: string,
    readonly importedAt: Date,
    readonly paymentMethod: PaymentMethod | null,
    readonly splitParts: number,
    /** True when the expense will be fully reimbursed by a third party — costs R$0 to payer and partner. */
    readonly reimbursed: boolean,
    /** True when the other household member co-owns this expense and owes their share back. */
    readonly splitWithPartner: boolean,
  ) {}

  /** The user's effective cost: R$0 if reimbursed, otherwise amount / splitParts. */
  get effectiveAmount(): Money {
    if (this.reimbursed) return Money.of(0)
    return Money.of(Math.round(this.amount.cents / this.splitParts))
  }

  static create(data: {
    id: PersonalExpenseId
    ownerId: UserId
    categoryId: CategoryId
    occurredAt: Date
    amount: Money
    description: string | null
    sourceId: string
    externalId: string
    importedAt?: Date
    paymentMethod?: PaymentMethod | null
    splitParts?: number
    reimbursed?: boolean
    splitWithPartner?: boolean
  }): PersonalExpense {
    return new PersonalExpense(
      data.id,
      data.ownerId,
      data.categoryId,
      data.occurredAt,
      data.amount,
      data.description,
      data.sourceId,
      data.externalId,
      data.importedAt ?? new Date(),
      data.paymentMethod ?? null,
      data.splitParts ?? 1,
      data.reimbursed ?? false,
      data.splitWithPartner ?? false,
    )
  }
}

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
  ) {}

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
    )
  }
}

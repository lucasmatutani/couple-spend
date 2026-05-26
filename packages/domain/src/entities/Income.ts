import { Money } from '../kernel/Money.js'
import { type IncomeId, type UserId } from '../kernel/ids.js'

export class Income {
  private constructor(
    readonly id: IncomeId,
    readonly ownerId: UserId,
    readonly occurredAt: Date,
    readonly amount: Money,
    readonly source: string,
    readonly recurring: boolean,
    readonly createdAt: Date,
  ) {}

  static create(data: {
    id: IncomeId
    ownerId: UserId
    occurredAt: Date
    amount: Money
    source: string
    recurring: boolean
    createdAt?: Date
  }): Income {
    return new Income(
      data.id,
      data.ownerId,
      data.occurredAt,
      data.amount,
      data.source,
      data.recurring,
      data.createdAt ?? new Date(),
    )
  }
}

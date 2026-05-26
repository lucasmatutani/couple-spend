import { Money } from '../kernel/Money.js'
import { type InvestmentId, type UserId } from '../kernel/ids.js'

export class Investment {
  private constructor(
    readonly id: InvestmentId,
    readonly ownerId: UserId,
    readonly occurredAt: Date,
    readonly amount: Money,
    readonly assetClass: string,
    readonly description: string | null,
    readonly createdAt: Date,
  ) {}

  static create(data: {
    id: InvestmentId
    ownerId: UserId
    occurredAt: Date
    amount: Money
    assetClass: string
    description: string | null
    createdAt?: Date
  }): Investment {
    return new Investment(
      data.id,
      data.ownerId,
      data.occurredAt,
      data.amount,
      data.assetClass,
      data.description,
      data.createdAt ?? new Date(),
    )
  }
}

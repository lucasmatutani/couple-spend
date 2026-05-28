import { type GoalId, type UserId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { InvalidGoalError } from '../errors.js'

export type GoalType = 'MAX_NEEDS' | 'MAX_WANTS' | 'MIN_SAVINGS' | 'MIN_SURPLUS'

export class Goal {
  private constructor(
    readonly id: GoalId,
    readonly ownerId: UserId,
    readonly goalType: GoalType,
    readonly targetPercent: number,
    readonly appliesToMonth: YearMonth | null,
    readonly createdAt: Date,
  ) {}

  static create(data: {
    id: GoalId
    ownerId: UserId
    goalType: GoalType
    targetPercent: number
    appliesToMonth: YearMonth | null
    createdAt?: Date
  }): Goal {
    if (!Number.isInteger(data.targetPercent) || data.targetPercent < 0 || data.targetPercent > 100) {
      throw new InvalidGoalError(
        `targetPercent must be an integer between 0 and 100, got ${data.targetPercent}`,
      )
    }
    return new Goal(
      data.id,
      data.ownerId,
      data.goalType,
      data.targetPercent,
      data.appliesToMonth,
      data.createdAt ?? new Date(),
    )
  }
}

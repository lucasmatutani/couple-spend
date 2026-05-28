import { describe, expect, it } from 'vitest'
import { Goal } from '../entities/Goal.js'
import { InvalidGoalError } from '../errors.js'
import { toGoalId, toUserId } from '../kernel/ids.js'
import { YearMonth } from '../kernel/YearMonth.js'

const OWNER = toUserId('user-1')
const ID = toGoalId('goal-1')

describe('Goal.create', () => {
  it('accepts targetPercent = 0', () => {
    const g = Goal.create({ id: ID, ownerId: OWNER, goalType: 'MIN_SURPLUS', targetPercent: 0, appliesToMonth: null })
    expect(g.targetPercent).toBe(0)
  })

  it('accepts targetPercent = 50', () => {
    const g = Goal.create({ id: ID, ownerId: OWNER, goalType: 'MAX_NEEDS', targetPercent: 50, appliesToMonth: null })
    expect(g.targetPercent).toBe(50)
  })

  it('accepts targetPercent = 100', () => {
    const g = Goal.create({ id: ID, ownerId: OWNER, goalType: 'MAX_WANTS', targetPercent: 100, appliesToMonth: null })
    expect(g.targetPercent).toBe(100)
  })

  it('throws InvalidGoalError for targetPercent = -1', () => {
    expect(() =>
      Goal.create({ id: ID, ownerId: OWNER, goalType: 'MAX_NEEDS', targetPercent: -1, appliesToMonth: null }),
    ).toThrow(InvalidGoalError)
  })

  it('throws InvalidGoalError for targetPercent = 101', () => {
    expect(() =>
      Goal.create({ id: ID, ownerId: OWNER, goalType: 'MIN_SAVINGS', targetPercent: 101, appliesToMonth: null }),
    ).toThrow(InvalidGoalError)
  })

  it('stores appliesToMonth when provided', () => {
    const month = YearMonth.fromString('2026-05')
    const g = Goal.create({ id: ID, ownerId: OWNER, goalType: 'MAX_NEEDS', targetPercent: 50, appliesToMonth: month })
    expect(g.appliesToMonth?.toString()).toBe('2026-05')
  })

  it('stores null appliesToMonth for recurring goals', () => {
    const g = Goal.create({ id: ID, ownerId: OWNER, goalType: 'MAX_NEEDS', targetPercent: 50, appliesToMonth: null })
    expect(g.appliesToMonth).toBeNull()
  })
})

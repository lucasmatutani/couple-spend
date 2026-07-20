import { describe, expect, it } from 'vitest'
import { EvaluateGoalsUseCase } from '../use-cases/EvaluateGoalsUseCase.js'
import { Goal } from '../entities/Goal.js'
import { Money } from '../kernel/Money.js'
import { YearMonth } from '../kernel/YearMonth.js'
import { toGoalId, toUserId } from '../kernel/ids.js'
import { type IndividualBudgetSummary } from '../use-cases/CalculateIndividualBudgetUseCase.js'

const OWNER = toUserId('user-1')
const MONTH = YearMonth.fromString('2026-05')

function makeBudget(overrides: Partial<{
  totalIncomeCents: number
  totalSpentCents: number
  totalInvestedCents: number
  surplusCents: number
  pctInvested: number
}>): IndividualBudgetSummary {
  const inc = overrides.totalIncomeCents ?? 100000
  const spent = overrides.totalSpentCents ?? 0
  const invested = overrides.totalInvestedCents ?? 0
  const surplus = overrides.surplusCents ?? (inc - spent - invested)
  const pctInvested = overrides.pctInvested ?? (inc > 0 ? invested / inc : 0)

  return {
    userId: OWNER,
    month: MONTH,
    totalIncome: Money.of(inc),
    totalSpent: Money.of(spent),
    totalInvested: Money.of(invested),
    surplus: Money.of(surplus),
    pctSpent: inc > 0 ? spent / inc : 0,
    pctInvested,
  }
}

function makeGoal(goalType: Goal['goalType'], targetPercent: number): Goal {
  return Goal.create({ id: toGoalId('g-1'), ownerId: OWNER, goalType, targetPercent, appliesToMonth: null })
}

describe('EvaluateGoalsUseCase', () => {
  const uc = new EvaluateGoalsUseCase()

  describe('MIN_SAVINGS', () => {
    it('on_track when actual is comfortably above minimum', () => {
      // target 20%, actual 30% → 0.30 > 0.20 * 1.2 = 0.24
      const budget = makeBudget({ pctInvested: 0.30 })
      const [ev] = uc.execute(budget, [makeGoal('MIN_SAVINGS', 20)])
      expect(ev!.status).toBe('on_track')
    })

    it('at_risk when barely above minimum', () => {
      // target 20%, actual 22% → 0.22 <= 0.20 * 1.2 = 0.24
      const budget = makeBudget({ pctInvested: 0.22 })
      const [ev] = uc.execute(budget, [makeGoal('MIN_SAVINGS', 20)])
      expect(ev!.status).toBe('at_risk')
    })

    it('exceeded (missed minimum) when actual < target', () => {
      const budget = makeBudget({ pctInvested: 0.10 })
      const [ev] = uc.execute(budget, [makeGoal('MIN_SAVINGS', 20)])
      expect(ev!.status).toBe('exceeded')
    })
  })

  describe('MIN_SURPLUS', () => {
    it('on_track when surplus is comfortably above target', () => {
      // income 100k, surplus 40k → actual 40% > target 20% * 1.2 = 24%
      const budget = makeBudget({ totalIncomeCents: 100000, surplusCents: 40000 })
      const [ev] = uc.execute(budget, [makeGoal('MIN_SURPLUS', 20)])
      expect(ev!.status).toBe('on_track')
      expect(ev!.actual).toBeCloseTo(0.40)
    })

    it('exceeded when surplus is below target', () => {
      // income 100k, surplus 10k → actual 10% < target 20%
      const budget = makeBudget({ totalIncomeCents: 100000, surplusCents: 10000 })
      const [ev] = uc.execute(budget, [makeGoal('MIN_SURPLUS', 20)])
      expect(ev!.status).toBe('exceeded')
    })
  })

  it('evaluates multiple goals independently', () => {
    const budget = makeBudget({ pctInvested: 0.25, surplusCents: 5000 })
    const goals = [makeGoal('MIN_SURPLUS', 20), makeGoal('MIN_SAVINGS', 20)]
    const evals = uc.execute(budget, goals)
    expect(evals).toHaveLength(2)
    expect(evals[0]!.status).toBe('exceeded')   // MIN_SURPLUS: 5% < 20%
    expect(evals[1]!.status).toBe('on_track')   // MIN_SAVINGS: 25% > 20% * 1.2 = 24%
  })
})

import { type Goal, type GoalType } from '../entities/Goal.js'
import { type IndividualBudgetSummary } from './CalculateIndividualBudgetUseCase.js'

export type GoalStatus = 'on_track' | 'at_risk' | 'exceeded'

export type GoalEvaluation = {
  goal: Goal
  /** 0..1 fraction of income */
  actual: number
  /** 0..1 fraction of income (= goal.targetPercent / 100) */
  target: number
  status: GoalStatus
}

export class EvaluateGoalsUseCase {
  execute(budget: IndividualBudgetSummary, goals: Goal[]): GoalEvaluation[] {
    return goals.map((goal) => {
      const target = goal.targetPercent / 100
      const actual = this.getActual(goal.goalType, budget)
      const status = this.getStatus(goal.goalType, actual, target)
      return { goal, actual, target, status }
    })
  }

  private getActual(goalType: GoalType, budget: IndividualBudgetSummary): number {
    switch (goalType) {
      case 'MIN_SAVINGS':
        return budget.pctInvested
      case 'MIN_SURPLUS': {
        const income = budget.totalIncome.cents
        return income > 0 ? budget.surplus.cents / income : 0
      }
    }
  }

  private getStatus(_goalType: GoalType, actual: number, target: number): GoalStatus {
    if (actual < target) return 'exceeded'
    if (actual <= target * 1.2) return 'at_risk'
    return 'on_track'
  }
}

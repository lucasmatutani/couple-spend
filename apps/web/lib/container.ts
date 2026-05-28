import {
  CalculateHouseholdSplitUseCase,
  CalculateIndividualBudgetUseCase,
  EvaluateGoalsUseCase,
} from '@splitwise/domain'
import { ImportTransactionsUseCase } from '@splitwise/import-core'
import { SupabaseCategoryRepository } from './repositories/SupabaseCategoryRepository'
import { SupabaseExpenseRepository } from './repositories/SupabaseExpenseRepository'
import { SupabaseGoalRepository } from './repositories/SupabaseGoalRepository'
import { SupabaseHouseholdRepository } from './repositories/SupabaseHouseholdRepository'
import { SupabaseImportRepository } from './repositories/SupabaseImportRepository'
import { SupabaseIncomeRepository } from './repositories/SupabaseIncomeRepository'
import { SupabaseInvestmentRepository } from './repositories/SupabaseInvestmentRepository'
import { SupabasePersonalExpenseRepository } from './repositories/SupabasePersonalExpenseRepository'
import { SupabaseUserRepository } from './repositories/SupabaseUserRepository'

export function getHouseholdSplitUseCase(): CalculateHouseholdSplitUseCase {
  return new CalculateHouseholdSplitUseCase(
    new SupabaseHouseholdRepository(),
    new SupabaseExpenseRepository(),
    new SupabaseUserRepository(),
  )
}

export function getIndividualBudgetUseCase(): CalculateIndividualBudgetUseCase {
  return new CalculateIndividualBudgetUseCase(
    new SupabaseHouseholdRepository(),
    new SupabaseExpenseRepository(),
    new SupabasePersonalExpenseRepository(),
    new SupabaseIncomeRepository(),
    new SupabaseInvestmentRepository(),
    new SupabaseCategoryRepository(),
  )
}

export function getEvaluateGoalsUseCase(): EvaluateGoalsUseCase {
  return new EvaluateGoalsUseCase()
}

export function getImportUseCase(): ImportTransactionsUseCase {
  const defaultResolver = {
    resolve: async () => ({ categoryId: 'other', confidence: 0.1, source: 'default' as const }),
  }
  const defaultPolicy = { apply: () => 'EQUAL' as const }
  const systemClock = { now: () => new Date() }
  return new ImportTransactionsUseCase(
    new SupabaseImportRepository(),
    defaultResolver,
    defaultPolicy,
    systemClock,
  )
}

export function getImportRepository(): SupabaseImportRepository {
  return new SupabaseImportRepository()
}

export function getGoalRepository(): SupabaseGoalRepository {
  return new SupabaseGoalRepository()
}

export function getIncomeRepository(): SupabaseIncomeRepository {
  return new SupabaseIncomeRepository()
}

export function getPersonalExpenseRepository(): SupabasePersonalExpenseRepository {
  return new SupabasePersonalExpenseRepository()
}

export function getInvestmentRepository(): SupabaseInvestmentRepository {
  return new SupabaseInvestmentRepository()
}

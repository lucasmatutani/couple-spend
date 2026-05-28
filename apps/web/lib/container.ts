import { CalculateHouseholdSplitUseCase, CalculateIndividualBudgetUseCase } from '@splitwise/domain'
import { SupabaseExpenseRepository } from './repositories/SupabaseExpenseRepository'
import { SupabaseHouseholdRepository } from './repositories/SupabaseHouseholdRepository'
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
  )
}

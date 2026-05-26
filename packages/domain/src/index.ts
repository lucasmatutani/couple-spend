// Kernel
export { Money } from './kernel/Money.js'
export { YearMonth } from './kernel/YearMonth.js'
export {
  toUserId,
  toHouseholdId,
  toExpenseId,
  toPersonalExpenseId,
  toIncomeId,
  toInvestmentId,
  toCategoryId,
  toGoalId,
} from './kernel/ids.js'
export type {
  UserId,
  HouseholdId,
  ExpenseId,
  PersonalExpenseId,
  IncomeId,
  InvestmentId,
  CategoryId,
  GoalId,
} from './kernel/ids.js'

// Errors
export { DomainError, InvalidSplitRuleError, InvalidExpenseError, InvalidMoneyError } from './errors.js'

// Value objects
export { SplitRule } from './SplitRule.js'
export type { SplitRuleType } from './SplitRule.js'

// Entities
export { Expense } from './entities/Expense.js'
export { PersonalExpense } from './entities/PersonalExpense.js'
export { Income } from './entities/Income.js'
export { Investment } from './entities/Investment.js'
export { Household } from './entities/Household.js'
export type { HouseholdMember, MemberRole } from './entities/Household.js'

// Ports
export type { ExpenseRepository } from './ports/ExpenseRepository.js'
export type { PersonalExpenseRepository } from './ports/PersonalExpenseRepository.js'
export type { IncomeRepository } from './ports/IncomeRepository.js'
export type { InvestmentRepository } from './ports/InvestmentRepository.js'
export type { HouseholdRepository } from './ports/HouseholdRepository.js'
export type { UserRepository, UserProfile } from './ports/UserRepository.js'

// Use cases
export { CalculateHouseholdSplitUseCase } from './use-cases/CalculateHouseholdSplitUseCase.js'
export type {
  HouseholdSplitSummary,
  MemberBalance,
  Settlement,
} from './use-cases/CalculateHouseholdSplitUseCase.js'

export { CalculateIndividualBudgetUseCase } from './use-cases/CalculateIndividualBudgetUseCase.js'
export type { IndividualBudgetSummary } from './use-cases/CalculateIndividualBudgetUseCase.js'

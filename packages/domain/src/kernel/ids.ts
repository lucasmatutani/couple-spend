// Branded ID types prevent mixing IDs of different aggregate roots at compile time.
// Pattern: type XId = string & { readonly __brand: "XId" }

export type UserId = string & { readonly __brand: 'UserId' }
export type HouseholdId = string & { readonly __brand: 'HouseholdId' }
export type ExpenseId = string & { readonly __brand: 'ExpenseId' }
export type PersonalExpenseId = string & { readonly __brand: 'PersonalExpenseId' }
export type IncomeId = string & { readonly __brand: 'IncomeId' }
export type InvestmentId = string & { readonly __brand: 'InvestmentId' }
export type CategoryId = string & { readonly __brand: 'CategoryId' }
export type GoalId = string & { readonly __brand: 'GoalId' }

function brandedId<T extends string>(label: string, id: string): T {
  if (!id.trim()) throw new Error(`${label} cannot be empty`)
  return id as T
}

export const toUserId = (id: string): UserId => brandedId<UserId>('UserId', id)
export const toHouseholdId = (id: string): HouseholdId => brandedId<HouseholdId>('HouseholdId', id)
export const toExpenseId = (id: string): ExpenseId => brandedId<ExpenseId>('ExpenseId', id)
export const toPersonalExpenseId = (id: string): PersonalExpenseId =>
  brandedId<PersonalExpenseId>('PersonalExpenseId', id)
export const toIncomeId = (id: string): IncomeId => brandedId<IncomeId>('IncomeId', id)
export const toInvestmentId = (id: string): InvestmentId => brandedId<InvestmentId>('InvestmentId', id)
export const toCategoryId = (id: string): CategoryId => brandedId<CategoryId>('CategoryId', id)
export const toGoalId = (id: string): GoalId => brandedId<GoalId>('GoalId', id)

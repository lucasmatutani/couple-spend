import { type ExpenseId, type HouseholdId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { type Expense } from '../entities/Expense.js'

export interface ExpenseRepository {
  findByHouseholdAndMonth(householdId: HouseholdId, month: YearMonth): Promise<Expense[]>
  save(expense: Expense): Promise<void>
  delete(id: ExpenseId): Promise<void>
}

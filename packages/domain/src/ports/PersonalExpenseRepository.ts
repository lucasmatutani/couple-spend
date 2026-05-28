import { type PersonalExpenseId, type UserId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { type PersonalExpense } from '../entities/PersonalExpense.js'

export interface PersonalExpenseRepository {
  findByOwnerAndMonth(ownerId: UserId, month: YearMonth): Promise<PersonalExpense[]>
  save(expense: PersonalExpense): Promise<void>
  delete(id: PersonalExpenseId): Promise<void>
}

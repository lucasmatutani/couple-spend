import { type UserId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { type Income } from '../entities/Income.js'

export interface IncomeRepository {
  findByOwnerAndMonth(ownerId: UserId, month: YearMonth): Promise<Income[]>
}

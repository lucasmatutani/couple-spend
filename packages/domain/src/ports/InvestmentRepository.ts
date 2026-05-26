import { type UserId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { type Investment } from '../entities/Investment.js'

export interface InvestmentRepository {
  findByOwnerAndMonth(ownerId: UserId, month: YearMonth): Promise<Investment[]>
}

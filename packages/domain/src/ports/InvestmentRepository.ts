import { type InvestmentId, type UserId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { type Investment } from '../entities/Investment.js'

export interface InvestmentRepository {
  findByOwnerAndMonth(ownerId: UserId, month: YearMonth): Promise<Investment[]>
  save(investment: Investment): Promise<void>
  delete(id: InvestmentId): Promise<void>
}

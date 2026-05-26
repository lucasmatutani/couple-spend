import { Money } from '../kernel/Money.js'
import { type UserId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { type ExpenseRepository } from '../ports/ExpenseRepository.js'
import { type HouseholdRepository } from '../ports/HouseholdRepository.js'
import { type IncomeRepository } from '../ports/IncomeRepository.js'
import { type InvestmentRepository } from '../ports/InvestmentRepository.js'
import { type PersonalExpenseRepository } from '../ports/PersonalExpenseRepository.js'

export type IndividualBudgetSummary = {
  userId: UserId
  month: YearMonth
  totalIncome: Money
  /** sharedShare + personalExpenses. Investments are NOT included (SPEC §10.2). */
  totalSpent: Money
  totalInvested: Money
  /** totalIncome - totalSpent - totalInvested */
  surplus: Money
  /** 0..1 fraction of income spent */
  pctSpent: number
  /** 0..1 fraction of income invested */
  pctInvested: number
}

export class CalculateIndividualBudgetUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly personalExpenseRepo: PersonalExpenseRepository,
    private readonly incomeRepo: IncomeRepository,
    private readonly investmentRepo: InvestmentRepository,
  ) {}

  async execute(userId: UserId, month: YearMonth): Promise<IndividualBudgetSummary> {
    const [households, personalExpenses, incomes, investments] = await Promise.all([
      this.householdRepo.findByMember(userId),
      this.personalExpenseRepo.findByOwnerAndMonth(userId, month),
      this.incomeRepo.findByOwnerAndMonth(userId, month),
      this.investmentRepo.findByOwnerAndMonth(userId, month),
    ])

    // Compute shared share across every household the user belongs to
    let sharedShareCents = 0
    for (const household of households) {
      const expenses = await this.expenseRepo.findByHouseholdAndMonth(household.id, month)
      const memberCount = household.memberCount()
      for (const expense of expenses) {
        sharedShareCents += expense.owedBy(userId, memberCount).cents
      }
    }

    const totalIncomeCents = incomes.reduce((sum, i) => sum + i.amount.cents, 0)
    const personalExpenseCents = personalExpenses.reduce((sum, e) => sum + e.amount.cents, 0)
    const totalInvestedCents = investments.reduce((sum, i) => sum + i.amount.cents, 0)

    const totalSpentCents = sharedShareCents + personalExpenseCents
    const surplusCents = totalIncomeCents - totalSpentCents - totalInvestedCents

    const pctSpent = totalIncomeCents > 0 ? totalSpentCents / totalIncomeCents : 0
    const pctInvested = totalIncomeCents > 0 ? totalInvestedCents / totalIncomeCents : 0

    return {
      userId,
      month,
      totalIncome: Money.of(totalIncomeCents),
      totalSpent: Money.of(totalSpentCents),
      totalInvested: Money.of(totalInvestedCents),
      surplus: Money.of(surplusCents),
      pctSpent,
      pctInvested,
    }
  }
}

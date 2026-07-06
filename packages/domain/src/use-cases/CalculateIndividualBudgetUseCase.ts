import { Money } from '../kernel/Money.js'
import { type UserId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { type CategoryRepository } from '../ports/CategoryRepository.js'
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
  /** 0..1 fraction of income spent per budget bucket (personal expenses only) */
  pctByBucket: {
    needs: number
    wants: number
    savings: number
  }
}

export class CalculateIndividualBudgetUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly personalExpenseRepo: PersonalExpenseRepository,
    private readonly incomeRepo: IncomeRepository,
    private readonly investmentRepo: InvestmentRepository,
    private readonly categoryRepo: CategoryRepository,
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
    const totalInvestedCents = investments.reduce((sum, i) => sum + i.amount.cents, 0)

    // Fetch categories to identify refunds and budget buckets.
    const firstHousehold = households[0]
    const catRows = firstHousehold ? await this.categoryRepo.findAll(firstHousehold.id) : []
    const catBuckets = new Map(catRows.map((c) => [c.id as string, c.budgetBucket] as const))
    const refundCategoryId = catRows.find((c) => c.name === 'Reembolsos')?.id as string | undefined

    // Refunds (Reembolsos) reduce spending rather than adding to it.
    let personalExpenseCents = 0
    let bucketNeeds = 0
    let bucketWants = 0
    let bucketSavings = 0
    for (const e of personalExpenses) {
      // Already represented as a shared expense in sharedShareCents above — counting
      // it here too would double the user's share (once via owedBy, once via effectiveAmount).
      if (e.splitWithPartner) continue

      const catId = e.categoryId as string
      const isRefund = refundCategoryId !== undefined && catId === refundCategoryId
      const effectiveCents = e.effectiveAmount.cents
      if (isRefund) {
        personalExpenseCents -= effectiveCents
      } else {
        personalExpenseCents += effectiveCents
        const bucket = catBuckets.get(catId) ?? 'needs'
        if (bucket === 'needs') bucketNeeds += effectiveCents
        else if (bucket === 'wants') bucketWants += effectiveCents
        else bucketSavings += effectiveCents
      }
    }

    const totalSpentCents = sharedShareCents + personalExpenseCents
    const surplusCents = totalIncomeCents - totalSpentCents - totalInvestedCents
    const pctSpent = totalIncomeCents > 0 ? totalSpentCents / totalIncomeCents : 0
    const pctInvested = totalIncomeCents > 0 ? totalInvestedCents / totalIncomeCents : 0

    const pctByBucket = {
      needs: totalIncomeCents > 0 ? bucketNeeds / totalIncomeCents : 0,
      wants: totalIncomeCents > 0 ? bucketWants / totalIncomeCents : 0,
      savings: totalIncomeCents > 0 ? bucketSavings / totalIncomeCents : 0,
    }

    return {
      userId,
      month,
      totalIncome: Money.of(totalIncomeCents),
      totalSpent: Money.of(totalSpentCents),
      totalInvested: Money.of(totalInvestedCents),
      surplus: Money.of(surplusCents),
      pctSpent,
      pctInvested,
      pctByBucket,
    }
  }
}

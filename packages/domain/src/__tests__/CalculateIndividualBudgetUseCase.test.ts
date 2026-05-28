import { describe, expect, it } from 'vitest'
import { CalculateIndividualBudgetUseCase } from '../use-cases/CalculateIndividualBudgetUseCase.js'
import { Expense } from '../entities/Expense.js'
import { PersonalExpense } from '../entities/PersonalExpense.js'
import { Income } from '../entities/Income.js'
import { Investment } from '../entities/Investment.js'
import { Household } from '../entities/Household.js'
import { Money } from '../kernel/Money.js'
import { YearMonth } from '../kernel/YearMonth.js'
import { SplitRule } from '../SplitRule.js'
import {
  toExpenseId,
  toHouseholdId,
  toPersonalExpenseId,
  toIncomeId,
  toInvestmentId,
  toUserId,
  toCategoryId,
  type HouseholdId,
  type UserId,
} from '../kernel/ids.js'
import { type ExpenseRepository } from '../ports/ExpenseRepository.js'
import { type HouseholdRepository } from '../ports/HouseholdRepository.js'
import { type IncomeRepository } from '../ports/IncomeRepository.js'
import { type InvestmentRepository } from '../ports/InvestmentRepository.js'
import { type PersonalExpenseRepository } from '../ports/PersonalExpenseRepository.js'

const USER = toUserId('user-a')
const OTHER = toUserId('user-b')
const HH_ID = toHouseholdId('hh-1')
const MONTH = YearMonth.fromString('2026-05')
const CAT = toCategoryId('cat-1')

function makeHousehold(userId: UserId, memberCount: number): Household {
  const members = Array.from({ length: memberCount }, (_, i) => ({
    userId: i === 0 ? userId : toUserId(`member-${i}`),
    role: (i === 0 ? 'owner' : 'member') as 'owner' | 'member',
    joinedAt: new Date(),
  }))
  return Household.create({ id: HH_ID, name: 'HH', createdBy: userId, members })
}

function makeExpense(id: string, paidBy: UserId, cents: number, rule: SplitRule): Expense {
  return Expense.create({
    id: toExpenseId(id),
    householdId: HH_ID,
    paidBy,
    categoryId: CAT,
    occurredAt: new Date('2026-05-10'),
    amount: Money.of(cents),
    description: null,
    splitRule: rule,
    sourceId: 'manual',
    externalId: id,
  })
}

function makePersonalExpense(cents: number): PersonalExpense {
  return PersonalExpense.create({
    id: toPersonalExpenseId('pe-1'),
    ownerId: USER,
    categoryId: CAT,
    occurredAt: new Date('2026-05-10'),
    amount: Money.of(cents),
    description: null,
    sourceId: 'manual',
    externalId: 'pe-ext-1',
  })
}

function makeIncome(cents: number): Income {
  return Income.create({
    id: toIncomeId('inc-1'),
    ownerId: USER,
    occurredAt: new Date('2026-05-01'),
    amount: Money.of(cents),
    source: 'salary',
    recurring: true,
  })
}

function makeInvestment(cents: number): Investment {
  return Investment.create({
    id: toInvestmentId('inv-1'),
    ownerId: USER,
    occurredAt: new Date('2026-05-05'),
    amount: Money.of(cents),
    assetClass: 'stocks',
    description: null,
  })
}

function makeRepos({
  households = [] as Household[],
  expenses = [] as Expense[],
  personalExpenses = [] as PersonalExpense[],
  incomes = [] as Income[],
  investments = [] as Investment[],
} = {}): {
  householdRepo: HouseholdRepository
  expenseRepo: ExpenseRepository
  personalExpenseRepo: PersonalExpenseRepository
  incomeRepo: IncomeRepository
  investmentRepo: InvestmentRepository
} {
  return {
    householdRepo: {
      findById: async (id: HouseholdId) => households.find((h) => h.id === id) ?? null,
      findByMember: async () => households,
      findFirstByMember: async () => households[0] ?? null,
      create: async () => { throw new Error('not implemented') },
      addMember: async () => { throw new Error('not implemented') },
    },
    expenseRepo: {
      findByHouseholdAndMonth: async () => expenses,
      save: async () => { throw new Error('not implemented') },
      delete: async () => { throw new Error('not implemented') },
    },
    personalExpenseRepo: {
      findByOwnerAndMonth: async () => personalExpenses,
      save: async () => { throw new Error('not implemented') },
      delete: async () => { throw new Error('not implemented') },
    },
    incomeRepo: {
      findByOwnerAndMonth: async () => incomes,
      save: async () => { throw new Error('not implemented') },
      delete: async () => { throw new Error('not implemented') },
    },
    investmentRepo: {
      findByOwnerAndMonth: async () => investments,
      save: async () => { throw new Error('not implemented') },
      delete: async () => { throw new Error('not implemented') },
    },
  }
}

describe('CalculateIndividualBudgetUseCase', () => {
  /**
   * Scenario:
   * - Income: 150 000¢
   * - Shared expense: 6000¢ EQUAL, 2 members → USER owes 3000¢ (sharedShare)
   * - Personal expense: 20 000¢
   * - Investment: 30 000¢
   *
   * totalSpent   = 3000 + 20000 = 23000¢   (investments NOT included — SPEC §10.2)
   * surplus      = 150000 - 23000 - 30000 = 97000¢
   * pctSpent     ≈ 0.1533
   * pctInvested  = 0.2
   */
  it('computes budget summary correctly', async () => {
    const household = makeHousehold(USER, 2)
    const sharedExpense = makeExpense('e1', OTHER, 6000, SplitRule.equal())

    const repos = makeRepos({
      households: [household],
      expenses: [sharedExpense],
      personalExpenses: [makePersonalExpense(20000)],
      incomes: [makeIncome(150000)],
      investments: [makeInvestment(30000)],
    })

    const useCase = new CalculateIndividualBudgetUseCase(
      repos.householdRepo,
      repos.expenseRepo,
      repos.personalExpenseRepo,
      repos.incomeRepo,
      repos.investmentRepo,
    )

    const summary = await useCase.execute(USER, MONTH)

    expect(summary.totalIncome.cents).toBe(150000)
    expect(summary.totalInvested.cents).toBe(30000)
    // sharedShare = 6000 * 0.5 = 3000
    expect(summary.totalSpent.cents).toBe(23000)
    expect(summary.surplus.cents).toBe(97000)
    expect(summary.pctSpent).toBeCloseTo(23000 / 150000)
    expect(summary.pctInvested).toBeCloseTo(30000 / 150000)
  })

  it('does NOT include investments in totalSpent (SPEC §10.2)', async () => {
    const repos = makeRepos({
      incomes: [makeIncome(100000)],
      investments: [makeInvestment(40000)],
    })

    const useCase = new CalculateIndividualBudgetUseCase(
      repos.householdRepo,
      repos.expenseRepo,
      repos.personalExpenseRepo,
      repos.incomeRepo,
      repos.investmentRepo,
    )

    const summary = await useCase.execute(USER, MONTH)

    expect(summary.totalSpent.cents).toBe(0)
    expect(summary.totalInvested.cents).toBe(40000)
    expect(summary.surplus.cents).toBe(60000)
  })

  it('handles zero income gracefully (no division by zero)', async () => {
    const repos = makeRepos({
      personalExpenses: [makePersonalExpense(5000)],
    })

    const useCase = new CalculateIndividualBudgetUseCase(
      repos.householdRepo,
      repos.expenseRepo,
      repos.personalExpenseRepo,
      repos.incomeRepo,
      repos.investmentRepo,
    )

    const summary = await useCase.execute(USER, MONTH)

    expect(summary.pctSpent).toBe(0)
    expect(summary.pctInvested).toBe(0)
  })

  it('sums income from multiple sources', async () => {
    const incomes = [makeIncome(80000), makeIncome(20000)]
    const repos = makeRepos({ incomes })

    const useCase = new CalculateIndividualBudgetUseCase(
      repos.householdRepo,
      repos.expenseRepo,
      repos.personalExpenseRepo,
      repos.incomeRepo,
      repos.investmentRepo,
    )

    const summary = await useCase.execute(USER, MONTH)
    expect(summary.totalIncome.cents).toBe(100000)
  })
})

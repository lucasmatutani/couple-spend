import { describe, expect, it } from 'vitest'
import { CalculateHouseholdSplitUseCase } from '../use-cases/CalculateHouseholdSplitUseCase.js'
import { Expense } from '../entities/Expense.js'
import { Household } from '../entities/Household.js'
import { Money } from '../kernel/Money.js'
import { YearMonth } from '../kernel/YearMonth.js'
import { SplitRule } from '../SplitRule.js'
import {
  toExpenseId,
  toHouseholdId,
  toUserId,
  toCategoryId,
  type HouseholdId,
  type UserId,
} from '../kernel/ids.js'
import { type ExpenseRepository } from '../ports/ExpenseRepository.js'
import { type HouseholdRepository } from '../ports/HouseholdRepository.js'
import { type UserRepository } from '../ports/UserRepository.js'

const HH_ID = toHouseholdId('hh-1')
const USER_A = toUserId('user-a')
const USER_B = toUserId('user-b')
const USER_C = toUserId('user-c')
const MONTH = YearMonth.fromString('2026-05')
const CAT = toCategoryId('cat-1')

function makeExpense(id: string, paidBy: UserId, amountCents: number, rule: SplitRule): Expense {
  return Expense.create({
    id: toExpenseId(id),
    householdId: HH_ID,
    paidBy,
    categoryId: CAT,
    occurredAt: new Date('2026-05-10'),
    amount: Money.of(amountCents),
    description: null,
    splitRule: rule,
    sourceId: 'manual',
    externalId: id,
  })
}

function makeHousehold(): Household {
  return Household.create({
    id: HH_ID,
    name: 'Test Household',
    createdBy: USER_A,
    members: [
      { userId: USER_A, role: 'owner', joinedAt: new Date() },
      { userId: USER_B, role: 'member', joinedAt: new Date() },
      { userId: USER_C, role: 'member', joinedAt: new Date() },
    ],
  })
}

function makeRepos(expenses: Expense[]) {
  const householdRepo: HouseholdRepository = {
    findById: async (id: HouseholdId) => (id === HH_ID ? makeHousehold() : null),
    findByMember: async () => [],
    findFirstByMember: async () => null,
    create: async () => { throw new Error('not implemented') },
    addMember: async () => { throw new Error('not implemented') },
  }

  const expenseRepo: ExpenseRepository = {
    findByHouseholdAndMonth: async () => expenses,
    save: async () => { throw new Error('not implemented') },
    delete: async () => { throw new Error('not implemented') },
  }

  const userRepo: UserRepository = {
    findById: async (id: UserId) => ({ id, displayName: id }),
    findManyById: async (ids: UserId[]) => ids.map((id) => ({ id, displayName: id })),
  }

  return { householdRepo, expenseRepo, userRepo }
}

describe('CalculateHouseholdSplitUseCase', () => {
  /**
   * Scenario (memberCount = 3):
   * Expense 1: 9000¢ EQUAL, paid by A → each owes 3000¢
   * Expense 2: 6000¢ EQUAL, paid by B → each owes 2000¢
   * Expense 3: 1500¢ ONLY_PAYER, paid by C → only C owes 1500¢
   * Expense 4: 3600¢ EQUAL, paid by A → each owes 1200¢
   *
   * Totals paid:  A=12600, B=6000, C=1500
   * Totals owed:  A=6200,  B=6200, C=7700
   * Net:          A=+6400, B=-200, C=-6200
   *
   * Settlements: C→A: 6200, B→A: 200
   */
  it('computes correct member balances for a 3-person household', async () => {
    const expenses = [
      makeExpense('e1', USER_A, 9000, SplitRule.equal()),
      makeExpense('e2', USER_B, 6000, SplitRule.equal()),
      makeExpense('e3', USER_C, 1500, SplitRule.onlyPayer()),
      makeExpense('e4', USER_A, 3600, SplitRule.equal()),
    ]
    const { householdRepo, expenseRepo, userRepo } = makeRepos(expenses)
    const useCase = new CalculateHouseholdSplitUseCase(householdRepo, expenseRepo, userRepo)

    const summary = await useCase.execute(HH_ID, MONTH)

    const balanceMap = Object.fromEntries(summary.memberBalances.map((b) => [b.userId, b]))

    expect(balanceMap[USER_A]!.paid.cents).toBe(12600)
    expect(balanceMap[USER_A]!.sharedShare.cents).toBe(6200)
    expect(balanceMap[USER_A]!.net.cents).toBe(6400)

    expect(balanceMap[USER_B]!.paid.cents).toBe(6000)
    expect(balanceMap[USER_B]!.sharedShare.cents).toBe(6200)
    expect(balanceMap[USER_B]!.net.cents).toBe(-200)

    expect(balanceMap[USER_C]!.paid.cents).toBe(1500)
    expect(balanceMap[USER_C]!.sharedShare.cents).toBe(7700)
    expect(balanceMap[USER_C]!.net.cents).toBe(-6200)
  })

  it('produces the minimum-transaction settlement', async () => {
    const expenses = [
      makeExpense('e1', USER_A, 9000, SplitRule.equal()),
      makeExpense('e2', USER_B, 6000, SplitRule.equal()),
      makeExpense('e3', USER_C, 1500, SplitRule.onlyPayer()),
      makeExpense('e4', USER_A, 3600, SplitRule.equal()),
    ]
    const { householdRepo, expenseRepo, userRepo } = makeRepos(expenses)
    const useCase = new CalculateHouseholdSplitUseCase(householdRepo, expenseRepo, userRepo)

    const summary = await useCase.execute(HH_ID, MONTH)

    // Two settlements: C→A and B→A
    expect(summary.settlements).toHaveLength(2)

    const cToA = summary.settlements.find((s) => s.from === USER_C && s.to === USER_A)
    expect(cToA).toBeDefined()
    expect(cToA!.amount.cents).toBe(6200)

    const bToA = summary.settlements.find((s) => s.from === USER_B && s.to === USER_A)
    expect(bToA).toBeDefined()
    expect(bToA!.amount.cents).toBe(200)
  })

  it('totals the expenses correctly', async () => {
    const expenses = [
      makeExpense('e1', USER_A, 9000, SplitRule.equal()),
      makeExpense('e2', USER_B, 6000, SplitRule.equal()),
      makeExpense('e3', USER_C, 1500, SplitRule.onlyPayer()),
      makeExpense('e4', USER_A, 3600, SplitRule.equal()),
    ]
    const { householdRepo, expenseRepo, userRepo } = makeRepos(expenses)
    const useCase = new CalculateHouseholdSplitUseCase(householdRepo, expenseRepo, userRepo)

    const summary = await useCase.execute(HH_ID, MONTH)

    expect(summary.totalExpenses.cents).toBe(20100)
  })

  it('returns empty settlements when the household has no expenses', async () => {
    const { householdRepo, expenseRepo, userRepo } = makeRepos([])
    const useCase = new CalculateHouseholdSplitUseCase(householdRepo, expenseRepo, userRepo)

    const summary = await useCase.execute(HH_ID, MONTH)

    expect(summary.settlements).toHaveLength(0)
    expect(summary.totalExpenses.cents).toBe(0)
  })

  it('throws when household is not found', async () => {
    const { expenseRepo, userRepo } = makeRepos([])
    const householdRepo: HouseholdRepository = {
      findById: async () => null,
      findByMember: async () => [],
      findFirstByMember: async () => null,
      create: async () => { throw new Error('not implemented') },
      addMember: async () => { throw new Error('not implemented') },
    }
    const useCase = new CalculateHouseholdSplitUseCase(householdRepo, expenseRepo, userRepo)

    await expect(useCase.execute(HH_ID, MONTH)).rejects.toThrow()
  })
})

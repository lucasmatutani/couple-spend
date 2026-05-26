import { describe, expect, it } from 'vitest'
import { Expense } from '../entities/Expense.js'
import { Money } from '../kernel/Money.js'
import { SplitRule } from '../SplitRule.js'
import { InvalidExpenseError } from '../errors.js'
import { toExpenseId, toHouseholdId, toUserId, toCategoryId } from '../kernel/ids.js'

const baseData = {
  id: toExpenseId('exp-1'),
  householdId: toHouseholdId('hh-1'),
  paidBy: toUserId('user-a'),
  categoryId: toCategoryId('cat-1'),
  occurredAt: new Date('2026-05-15'),
  amount: Money.of(9000),
  description: null,
  splitRule: SplitRule.equal(),
  sourceId: 'manual',
  externalId: 'ext-1',
}

describe('Expense', () => {
  describe('create()', () => {
    it('creates a valid expense', () => {
      const expense = Expense.create(baseData)
      expect(expense.amount.cents).toBe(9000)
      expect(expense.paidBy).toBe(baseData.paidBy)
    })

    it('throws InvalidExpenseError for zero amount', () => {
      expect(() =>
        Expense.create({ ...baseData, amount: Money.of(0) }),
      ).toThrow(InvalidExpenseError)
    })

    it('throws InvalidExpenseError for negative amount', () => {
      expect(() =>
        Expense.create({ ...baseData, amount: Money.of(-100) }),
      ).toThrow(InvalidExpenseError)
    })

    it('throws InvalidExpenseError for invalid date', () => {
      expect(() =>
        Expense.create({ ...baseData, occurredAt: new Date('not-a-date') }),
      ).toThrow(InvalidExpenseError)
    })

    it('uses current date for importedAt when not provided', () => {
      const before = new Date()
      const expense = Expense.create(baseData)
      const after = new Date()
      expect(expense.importedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
      expect(expense.importedAt.getTime()).toBeLessThanOrEqual(after.getTime())
    })
  })

  describe('owedBy() — EQUAL split, 3 members', () => {
    const expense = Expense.create({ ...baseData, amount: Money.of(9000), splitRule: SplitRule.equal() })

    it('payer owes their equal share', () => {
      // 9000 * (1/3) = 3000
      expect(expense.owedBy(toUserId('user-a'), 3).cents).toBe(3000)
    })

    it('non-payer owes their equal share', () => {
      // 9000 * (1/3) = 3000
      expect(expense.owedBy(toUserId('user-b'), 3).cents).toBe(3000)
    })
  })

  describe('owedBy() — ONLY_PAYER split', () => {
    const expense = Expense.create({ ...baseData, amount: Money.of(1500), splitRule: SplitRule.onlyPayer() })

    it('payer owes full amount', () => {
      expect(expense.owedBy(toUserId('user-a'), 3).cents).toBe(1500)
    })

    it('non-payer owes nothing', () => {
      expect(expense.owedBy(toUserId('user-b'), 3).cents).toBe(0)
    })
  })

  describe('owedBy() — ONLY_OTHER split', () => {
    const expense = Expense.create({ ...baseData, amount: Money.of(6000), splitRule: SplitRule.onlyOther() })

    it('payer owes nothing', () => {
      expect(expense.owedBy(toUserId('user-a'), 3).cents).toBe(0)
    })

    it('non-payer owes full amount', () => {
      expect(expense.owedBy(toUserId('user-b'), 3).cents).toBe(6000)
    })
  })

  describe('owedBy() — CUSTOM split', () => {
    const expense = Expense.create({ ...baseData, amount: Money.of(10000), splitRule: SplitRule.custom(70) })

    it('payer owes 70%', () => {
      expect(expense.owedBy(toUserId('user-a'), 2).cents).toBe(7000)
    })

    it('other owes 30%', () => {
      expect(expense.owedBy(toUserId('user-b'), 2).cents).toBe(3000)
    })
  })
})

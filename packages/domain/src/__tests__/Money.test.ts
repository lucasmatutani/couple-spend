import { describe, expect, it } from 'vitest'
import { Money } from '../kernel/Money.js'

describe('Money', () => {
  describe('of()', () => {
    it('creates from integer cents', () => {
      expect(Money.of(150).cents).toBe(150)
    })

    it('throws for non-integer cents', () => {
      expect(() => Money.of(1.5)).toThrow(TypeError)
    })

    it('accepts zero', () => {
      expect(Money.of(0).cents).toBe(0)
    })

    it('accepts negative cents', () => {
      expect(Money.of(-100).cents).toBe(-100)
    })
  })

  describe('ZERO', () => {
    it('is zero cents', () => {
      expect(Money.ZERO.cents).toBe(0)
    })
  })

  describe('add()', () => {
    it('sums two amounts', () => {
      expect(Money.of(100).add(Money.of(50)).cents).toBe(150)
    })

    it('adding zero returns same value', () => {
      expect(Money.of(200).add(Money.ZERO).cents).toBe(200)
    })
  })

  describe('subtract()', () => {
    it('subtracts two amounts', () => {
      expect(Money.of(200).subtract(Money.of(50)).cents).toBe(150)
    })

    it('can produce negative result', () => {
      expect(Money.of(50).subtract(Money.of(100)).cents).toBe(-50)
    })
  })

  describe('multiply()', () => {
    it('multiplies by a factor', () => {
      expect(Money.of(100).multiply(1.5).cents).toBe(150)
    })

    it('rounds to nearest cent', () => {
      // 100 * (1/3) = 33.333... → 33
      expect(Money.of(100).multiply(1 / 3).cents).toBe(33)
    })

    it('rounds up at 0.5', () => {
      // 101 * 0.5 = 50.5 → 51
      expect(Money.of(101).multiply(0.5).cents).toBe(51)
    })

    it('multiplying by zero returns zero', () => {
      expect(Money.of(500).multiply(0).cents).toBe(0)
    })
  })

  describe('percentage()', () => {
    it('computes percentage of amount', () => {
      expect(Money.of(10000).percentage(30).cents).toBe(3000)
    })

    it('is equivalent to multiply(pct/100)', () => {
      const m = Money.of(9999)
      expect(m.percentage(25).cents).toBe(m.multiply(0.25).cents)
    })
  })

  describe('toUnits()', () => {
    it('converts cents to currency units', () => {
      expect(Money.of(12350).toUnits()).toBeCloseTo(123.5)
    })
  })

  describe('format()', () => {
    it('formats BRL with dot thousands separator and comma decimal', () => {
      expect(Money.of(123456).format()).toBe('R$ 1.234,56')
    })

    it('formats zero', () => {
      expect(Money.of(0).format()).toBe('R$ 0,00')
    })

    it('formats amounts under 100 cents with leading zero', () => {
      expect(Money.of(5).format()).toBe('R$ 0,05')
    })

    it('formats negative amounts', () => {
      expect(Money.of(-9900).format()).toBe('-R$ 99,00')
    })

    it('formats large amounts', () => {
      expect(Money.of(1000000000).format()).toBe('R$ 10.000.000,00')
    })
  })

  describe('isZero()', () => {
    it('returns true for zero', () => {
      expect(Money.ZERO.isZero()).toBe(true)
    })

    it('returns false for non-zero', () => {
      expect(Money.of(1).isZero()).toBe(false)
    })
  })

  describe('isPositive()', () => {
    it('returns true for positive amount', () => {
      expect(Money.of(1).isPositive()).toBe(true)
    })

    it('returns false for zero', () => {
      expect(Money.ZERO.isPositive()).toBe(false)
    })

    it('returns false for negative amount', () => {
      expect(Money.of(-1).isPositive()).toBe(false)
    })
  })

  describe('equals()', () => {
    it('returns true for same amount', () => {
      expect(Money.of(100).equals(Money.of(100))).toBe(true)
    })

    it('returns false for different amounts', () => {
      expect(Money.of(100).equals(Money.of(101))).toBe(false)
    })
  })
})

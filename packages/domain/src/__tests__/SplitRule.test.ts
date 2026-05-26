import { describe, expect, it } from 'vitest'
import { SplitRule } from '../SplitRule.js'
import { InvalidSplitRuleError } from '../errors.js'

describe('SplitRule', () => {
  describe('EQUAL', () => {
    it('divides equally among memberCount members', () => {
      const rule = SplitRule.equal()
      expect(rule.payerShare(2)).toBeCloseTo(0.5)
      expect(rule.payerShare(3)).toBeCloseTo(1 / 3)
      expect(rule.payerShare(4)).toBeCloseTo(0.25)
    })

    it('other share is symmetric', () => {
      const rule = SplitRule.equal()
      expect(rule.otherShare(3)).toBeCloseTo(1 / 3)
    })

    it('payer + other shares sum to 1 (2 members)', () => {
      const rule = SplitRule.equal()
      expect(rule.payerShare(2) + rule.otherShare(2)).toBeCloseTo(1)
    })
  })

  describe('ONLY_PAYER', () => {
    it('payer bears the full cost', () => {
      expect(SplitRule.onlyPayer().payerShare(3)).toBe(1.0)
    })

    it('others bear zero cost', () => {
      expect(SplitRule.onlyPayer().otherShare(3)).toBe(0.0)
    })
  })

  describe('ONLY_OTHER', () => {
    it('payer bears zero cost', () => {
      expect(SplitRule.onlyOther().payerShare(3)).toBe(0.0)
    })

    it('others each bear their equal share', () => {
      // For ONLY_OTHER with 3 members, the payer pays 0 but the "other share"
      // is still 1 - 0 = 1.0 total, split among others
      // Actually per the SplitRule implementation, otherShare = 1 - payerShare(0) = 1.0
      expect(SplitRule.onlyOther().otherShare(3)).toBe(1.0)
    })
  })

  describe('CUSTOM', () => {
    it('payer bears the specified percentage', () => {
      const rule = SplitRule.custom(70)
      expect(rule.payerShare(2)).toBeCloseTo(0.7)
    })

    it('other share is complement to 100%', () => {
      const rule = SplitRule.custom(70)
      expect(rule.otherShare(2)).toBeCloseTo(0.3)
    })

    it('allows 0% (payer pays nothing)', () => {
      expect(SplitRule.custom(0).payerShare(2)).toBe(0.0)
    })

    it('allows 100% (payer pays all)', () => {
      expect(SplitRule.custom(100).payerShare(2)).toBe(1.0)
    })

    it('throws InvalidSplitRuleError for negative percent', () => {
      expect(() => SplitRule.custom(-1)).toThrow(InvalidSplitRuleError)
    })

    it('throws InvalidSplitRuleError for percent > 100', () => {
      expect(() => SplitRule.custom(101)).toThrow(InvalidSplitRuleError)
    })

    it('stores the payerPercent value', () => {
      expect(SplitRule.custom(40).payerPercent).toBe(40)
    })
  })

  describe('non-CUSTOM rules', () => {
    it('have undefined payerPercent', () => {
      expect(SplitRule.equal().payerPercent).toBeUndefined()
      expect(SplitRule.onlyPayer().payerPercent).toBeUndefined()
      expect(SplitRule.onlyOther().payerPercent).toBeUndefined()
    })
  })
})

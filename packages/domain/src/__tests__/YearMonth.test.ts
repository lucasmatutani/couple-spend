import { describe, expect, it } from 'vitest'
import { YearMonth } from '../kernel/YearMonth.js'

describe('YearMonth', () => {
  describe('fromString()', () => {
    it('parses valid YYYY-MM string', () => {
      const ym = YearMonth.fromString('2026-05')
      expect(ym.year).toBe(2026)
      expect(ym.month).toBe(5)
    })

    it('throws for invalid format', () => {
      expect(() => YearMonth.fromString('2026/05')).toThrow()
      expect(() => YearMonth.fromString('26-05')).toThrow()
    })

    it('throws for invalid month', () => {
      expect(() => YearMonth.fromString('2026-00')).toThrow()
      expect(() => YearMonth.fromString('2026-13')).toThrow()
    })
  })

  describe('fromDate()', () => {
    it('extracts year and month from a date', () => {
      const ym = YearMonth.fromDate(new Date(2026, 4, 15)) // May
      expect(ym.year).toBe(2026)
      expect(ym.month).toBe(5)
    })
  })

  describe('startDate()', () => {
    it('returns the first day of the month', () => {
      const ym = YearMonth.fromString('2026-05')
      const start = ym.startDate()
      expect(start.getFullYear()).toBe(2026)
      expect(start.getMonth()).toBe(4) // 0-indexed
      expect(start.getDate()).toBe(1)
    })
  })

  describe('endDate()', () => {
    it('returns the last day of the month', () => {
      const ym = YearMonth.fromString('2026-02')
      const end = ym.endDate()
      expect(end.getDate()).toBe(28) // 2026 is not a leap year
    })

    it('returns 31 for months with 31 days', () => {
      const end = YearMonth.fromString('2026-01').endDate()
      expect(end.getDate()).toBe(31)
    })

    it('returns 30 for April', () => {
      const end = YearMonth.fromString('2026-04').endDate()
      expect(end.getDate()).toBe(30)
    })
  })

  describe('previous()', () => {
    it('returns the previous month', () => {
      expect(YearMonth.fromString('2026-05').previous().toString()).toBe('2026-04')
    })

    it('wraps back to December of the previous year', () => {
      expect(YearMonth.fromString('2026-01').previous().toString()).toBe('2025-12')
    })
  })

  describe('next()', () => {
    it('returns the next month', () => {
      expect(YearMonth.fromString('2026-05').next().toString()).toBe('2026-06')
    })

    it('wraps forward to January of the next year', () => {
      expect(YearMonth.fromString('2026-12').next().toString()).toBe('2027-01')
    })
  })

  describe('toString()', () => {
    it('returns YYYY-MM with zero-padded month', () => {
      expect(YearMonth.fromString('2026-01').toString()).toBe('2026-01')
      expect(YearMonth.fromString('2026-12').toString()).toBe('2026-12')
    })
  })

  describe('equals()', () => {
    it('returns true for same year and month', () => {
      expect(YearMonth.fromString('2026-05').equals(YearMonth.fromString('2026-05'))).toBe(true)
    })

    it('returns false for different month', () => {
      expect(YearMonth.fromString('2026-05').equals(YearMonth.fromString('2026-06'))).toBe(false)
    })

    it('returns false for different year', () => {
      expect(YearMonth.fromString('2026-05').equals(YearMonth.fromString('2025-05'))).toBe(false)
    })
  })
})

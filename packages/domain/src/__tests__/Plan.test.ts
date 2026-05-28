import { describe, expect, it } from 'vitest'
import { getLimits, canAddMember, canImportMonth } from '../billing/Plan.js'

describe('getLimits', () => {
  it('free plan limits', () => {
    const limits = getLimits('free')
    expect(limits.maxHouseholdMembers).toBe(2)
    expect(limits.maxImportMonthsHistory).toBe(3)
    expect(limits.llmCategorizationEnabled).toBe(false)
    expect(limits.openFinanceEnabled).toBe(false)
  })

  it('pro plan limits', () => {
    const limits = getLimits('pro')
    expect(limits.maxHouseholdMembers).toBe(5)
    expect(limits.maxImportMonthsHistory).toBe(24)
    expect(limits.llmCategorizationEnabled).toBe(true)
    expect(limits.openFinanceEnabled).toBe(true)
  })

  it('family plan limits', () => {
    const limits = getLimits('family')
    expect(limits.maxHouseholdMembers).toBe(10)
    expect(limits.maxImportMonthsHistory).toBe(60)
    expect(limits.llmCategorizationEnabled).toBe(true)
    expect(limits.openFinanceEnabled).toBe(true)
  })
})

describe('canAddMember', () => {
  it('free allows up to 2 members', () => {
    expect(canAddMember('free', 0)).toBe(true)
    expect(canAddMember('free', 1)).toBe(true)
    expect(canAddMember('free', 2)).toBe(false) // already at limit
    expect(canAddMember('free', 3)).toBe(false)
  })

  it('pro allows up to 5 members', () => {
    expect(canAddMember('pro', 4)).toBe(true)
    expect(canAddMember('pro', 5)).toBe(false)
  })

  it('family allows up to 10 members', () => {
    expect(canAddMember('family', 9)).toBe(true)
    expect(canAddMember('family', 10)).toBe(false)
  })
})

describe('canImportMonth', () => {
  it('free allows current and up to 3 months ago', () => {
    expect(canImportMonth('free', 0)).toBe(true)
    expect(canImportMonth('free', 3)).toBe(true)
    expect(canImportMonth('free', 4)).toBe(false)
  })

  it('pro allows up to 24 months ago', () => {
    expect(canImportMonth('pro', 24)).toBe(true)
    expect(canImportMonth('pro', 25)).toBe(false)
  })

  it('family allows up to 60 months ago', () => {
    expect(canImportMonth('family', 60)).toBe(true)
    expect(canImportMonth('family', 61)).toBe(false)
  })
})

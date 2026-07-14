import { describe, expect, it } from 'vitest'
import { normalizeDescriptionForMemory } from '../normalizeDescription.js'

describe('normalizeDescriptionForMemory', () => {
  it('strips a trailing installment counter', () => {
    expect(normalizeDescriptionForMemory('AMAZON.COM.BR 02/12')).toBe('AMAZON.COM.BR')
    expect(normalizeDescriptionForMemory('LOJA XYZ 3/6')).toBe('LOJA XYZ')
  })

  it('strips a parenthesized installment counter', () => {
    expect(normalizeDescriptionForMemory('MAGAZINE LUIZA (01/10)')).toBe('MAGAZINE LUIZA')
  })

  it('strips an installment counter glued directly onto the merchant name (no separator)', () => {
    expect(normalizeDescriptionForMemory('MERCADOLIVRE*FEIZA07/12')).toBe('MERCADOLIVRE*FEIZA')
  })

  it('normalizes different installments of the same purchase to the same key', () => {
    const month1 = normalizeDescriptionForMemory('AMAZON.COM.BR 02/12')
    const month2 = normalizeDescriptionForMemory('AMAZON.COM.BR 03/12')
    expect(month1).toBe(month2)
  })

  it('leaves descriptions without an installment counter untouched', () => {
    expect(normalizeDescriptionForMemory('UBER TRIP')).toBe('UBER TRIP')
  })
})

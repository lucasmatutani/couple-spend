import { describe, it, expect } from 'vitest'
import { buildUnifiedPrompt } from '../prompt'

const categories = [{ id: 'cat-1', name: 'Outros' }]

describe('buildUnifiedPrompt', () => {
  it('omits shared-bill instructions and schema field when no keywords are registered', () => {
    const prompt = buildUnifiedPrompt(categories)
    expect(prompt).not.toContain('RECURRING SHARED-BILL DETECTION')
    expect(prompt).not.toContain('isSharedBill')
  })

  it('includes registered keywords and the isSharedBill schema field', () => {
    const prompt = buildUnifiedPrompt(categories, ['Netflix', 'Condomínio'])
    expect(prompt).toContain('RECURRING SHARED-BILL DETECTION')
    expect(prompt).toContain('"Netflix"')
    expect(prompt).toContain('"Condomínio"')
    expect(prompt).toContain('"isSharedBill": boolean')
  })

  it('omits full-refund instructions and schema field when no keywords are registered', () => {
    const prompt = buildUnifiedPrompt(categories)
    expect(prompt).not.toContain('FULL-REFUND BILL DETECTION')
    expect(prompt).not.toContain('isFullyReimbursed')
  })

  it('includes registered full-refund keywords and the isFullyReimbursed schema field', () => {
    const prompt = buildUnifiedPrompt(categories, [], ['Plano de Saúde'])
    expect(prompt).toContain('FULL-REFUND BILL DETECTION')
    expect(prompt).toContain('"Plano de Saúde"')
    expect(prompt).toContain('"isFullyReimbursed": boolean')
    expect(prompt).not.toContain('RECURRING SHARED-BILL DETECTION')
  })

  it('includes both sections independently when both keyword lists are registered', () => {
    const prompt = buildUnifiedPrompt(categories, ['Netflix'], ['Plano de Saúde'])
    expect(prompt).toContain('RECURRING SHARED-BILL DETECTION')
    expect(prompt).toContain('FULL-REFUND BILL DETECTION')
    expect(prompt).toContain('"isSharedBill": boolean')
    expect(prompt).toContain('"isFullyReimbursed": boolean')
  })
})

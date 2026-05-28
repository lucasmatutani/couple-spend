import { describe, expect, it } from 'vitest'
import { RuleBasedResolver, DEFAULT_RULES, type CategoryRule } from '../resolvers/RuleBasedResolver.js'
import type { RawTransaction } from '@splitwise/import-core'

function makeTx(description: string): RawTransaction {
  return {
    externalId: 'ext-1',
    occurredAt: new Date('2026-05-01'),
    amountCents: 10000,
    description,
    currency: 'BRL',
    sourceInstitution: 'Test',
  }
}

describe('RuleBasedResolver', () => {
  describe('DEFAULT_RULES pattern matching', () => {
    const resolver = new RuleBasedResolver(DEFAULT_RULES)

    it.each([
      ['POSTO IPIRANGA', 'Transport'],
      ['SHELL COMBUSTIVEIS', 'Transport'],
      ['UBER TRIP 123', 'Transport'],
      ['SUPERMERCADO EXTRA', 'Groceries'],
      ['PAG CARREFOUR', 'Groceries'],
      ['ESCOLA ESTADUAL', 'Education'],
      ['FACULDADE ABC', 'Education'],
      ['FARMACIA PACHECO', 'Health'],
      ['DROGA RAIA LTDA', 'Health'],
      ['NETFLIX.COM', 'Subscriptions'],
      ['SPOTIFY USA', 'Subscriptions'],
      ['RESTAURANTE BELA', 'Dining out'],
      ['MCDONALDS BRASIL', 'Dining out'],
      ['ALUGUEL APARTAMENTO', 'Housing'],
      ['CONDOMINIO RESIDENCIAL', 'Housing'],
      ['ENEL ENERGIA', 'Utilities'],
      ['CPFL ENERGIA SA', 'Utilities'],
      ['CLARO NET TELECOMUNICACOES', 'Utilities'],
      ['VIVO FIBRA', 'Utilities'],
    ])('"%s" → %s', async (description, expectedCategory) => {
      const result = await resolver.resolve(makeTx(description))
      expect(result).not.toBeNull()
      expect(result!.categoryId).toBe(expectedCategory)
      expect(result!.confidence).toBe(1.0)
      expect(result!.source).toBe('rule')
    })

    it('returns null for unknown descriptions', async () => {
      const result = await resolver.resolve(makeTx('PAGAMENTO DIVERSO'))
      expect(result).toBeNull()
    })
  })

  it('higher priority rule wins when patterns could both match', async () => {
    const rules: CategoryRule[] = [
      { pattern: 'uber', categoryId: 'transport', priority: 100 },
      { pattern: 'uber|restaurante', categoryId: 'food', priority: 50 },
    ]
    const resolver = new RuleBasedResolver(rules)
    const result = await resolver.resolve(makeTx('UBER EATS PEDIDO'))
    expect(result!.categoryId).toBe('transport')
  })

  it('matching is case-insensitive', async () => {
    const rules: CategoryRule[] = [{ pattern: 'netflix', categoryId: 'streaming', priority: 1 }]
    const resolver = new RuleBasedResolver(rules)
    expect(await resolver.resolve(makeTx('NETFLIX SUBSCRIPTION'))).not.toBeNull()
    expect(await resolver.resolve(makeTx('netflix monthly'))).not.toBeNull()
    expect(await resolver.resolve(makeTx('Netflix.com'))).not.toBeNull()
  })
})

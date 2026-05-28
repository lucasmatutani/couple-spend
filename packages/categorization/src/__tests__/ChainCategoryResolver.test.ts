import { describe, expect, it } from 'vitest'
import { ChainCategoryResolver } from '../resolvers/ChainCategoryResolver.js'
import { DefaultResolver } from '../resolvers/DefaultResolver.js'
import type { CategoryResolverChainLink } from '../resolvers/CategoryResolverChainLink.js'
import type { CategoryResolution, RawTransaction } from '@splitwise/import-core'

function makeTx(description = 'Test'): RawTransaction {
  return {
    externalId: 'ext-1',
    occurredAt: new Date('2026-05-01'),
    amountCents: 1000,
    description,
    currency: 'BRL',
    sourceInstitution: 'Test',
  }
}

function makeLink(result: CategoryResolution | null): CategoryResolverChainLink {
  return { resolve: async () => result }
}

describe('ChainCategoryResolver', () => {
  it('stops at first link with confidence >= threshold', async () => {
    const highConf = makeLink({ categoryId: 'cat-a', confidence: 1.0, source: 'rule' })
    const lowConf = makeLink({ categoryId: 'cat-b', confidence: 0.2, source: 'memory' })
    const chain = new ChainCategoryResolver([highConf, lowConf])
    const result = await chain.resolve(makeTx())
    expect(result.categoryId).toBe('cat-a')
  })

  it('falls through to next link when confidence is below threshold', async () => {
    const tooLow = makeLink({ categoryId: 'cat-low', confidence: 0.3, source: 'memory' })
    const highConf = makeLink({ categoryId: 'cat-high', confidence: 0.9, source: 'rule' })
    const chain = new ChainCategoryResolver([tooLow, highConf])
    const result = await chain.resolve(makeTx())
    expect(result.categoryId).toBe('cat-high')
  })

  it('skips null results and continues to next link', async () => {
    const nullLink = makeLink(null)
    const validLink = makeLink({ categoryId: 'cat-valid', confidence: 1.0, source: 'rule' })
    const chain = new ChainCategoryResolver([nullLink, validLink])
    const result = await chain.resolve(makeTx())
    expect(result.categoryId).toBe('cat-valid')
  })

  it('returns last non-null result when all are below threshold', async () => {
    const low1 = makeLink({ categoryId: 'cat-low1', confidence: 0.2, source: 'memory' })
    const low2 = makeLink({ categoryId: 'cat-low2', confidence: 0.4, source: 'llm' })
    const chain = new ChainCategoryResolver([low1, low2], 0.7)
    const result = await chain.resolve(makeTx())
    expect(result.categoryId).toBe('cat-low2')
  })

  it('DefaultResolver is the last resort when all other links return null', async () => {
    const nullLink = makeLink(null)
    const fallback = new DefaultResolver('other-cat-id')
    const chain = new ChainCategoryResolver([nullLink, fallback])
    const result = await chain.resolve(makeTx())
    expect(result.categoryId).toBe('other-cat-id')
    expect(result.confidence).toBe(0)
    expect(result.source).toBe('default')
  })

  it('emergency fallback when ALL links return null (no DefaultResolver)', async () => {
    const chain = new ChainCategoryResolver([makeLink(null), makeLink(null)])
    const result = await chain.resolve(makeTx())
    expect(result.categoryId).toBe('other')
    expect(result.source).toBe('default')
  })

  it('uses custom threshold', async () => {
    const mid = makeLink({ categoryId: 'mid', confidence: 0.5, source: 'memory' })
    const high = makeLink({ categoryId: 'high', confidence: 0.8, source: 'rule' })
    const chain = new ChainCategoryResolver([mid, high], 0.4)
    // With threshold 0.4, mid (0.5) is already >= threshold
    const result = await chain.resolve(makeTx())
    expect(result.categoryId).toBe('mid')
  })
})

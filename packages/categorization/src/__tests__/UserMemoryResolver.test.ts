import { describe, expect, it } from 'vitest'
import { UserMemoryResolver } from '../resolvers/UserMemoryResolver.js'
import type { CategoryMemoryRepository, CategoryMemoryRow } from '../ports/CategoryMemoryRepository.js'
import type { RawTransaction } from '@splitwise/import-core'

function makeTx(description: string): RawTransaction {
  return {
    externalId: 'ext-1',
    occurredAt: new Date('2026-05-01'),
    amountCents: 5000,
    description,
    currency: 'BRL',
    sourceInstitution: 'Test',
  }
}

function makeMemoryRow(categoryId: string, confidence: number): CategoryMemoryRow {
  return {
    id: 'mem-1',
    householdId: 'hh-1',
    ownerId: 'user-1',
    descriptionPattern: 'padaria',
    categoryId,
    confidence,
  }
}

describe('UserMemoryResolver', () => {
  it('returns a resolution on memory hit', async () => {
    const repo: CategoryMemoryRepository = {
      findByPattern: async () => makeMemoryRow('food-id', 0.9),
      save: async () => {},
    }
    const resolver = new UserMemoryResolver(repo, 'hh-1', 'user-1')
    const result = await resolver.resolve(makeTx('Padaria do Joao'))
    expect(result).not.toBeNull()
    expect(result!.categoryId).toBe('food-id')
    expect(result!.confidence).toBe(0.9)
    expect(result!.source).toBe('memory')
  })

  it('returns null on memory miss', async () => {
    const repo: CategoryMemoryRepository = {
      findByPattern: async () => null,
      save: async () => {},
    }
    const resolver = new UserMemoryResolver(repo, 'hh-1', 'user-1')
    const result = await resolver.resolve(makeTx('MERCADO LIVRE'))
    expect(result).toBeNull()
  })

  it('forwards householdId, ownerId, and description to the repository', async () => {
    let capturedArgs: [string, string, string] | null = null
    const repo: CategoryMemoryRepository = {
      findByPattern: async (hh, owner, pattern) => {
        capturedArgs = [hh, owner, pattern]
        return null
      },
      save: async () => {},
    }
    const resolver = new UserMemoryResolver(repo, 'hh-abc', 'user-xyz')
    await resolver.resolve(makeTx('Test Description'))
    expect(capturedArgs).toEqual(['hh-abc', 'user-xyz', 'Test Description'])
  })
})

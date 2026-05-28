import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { OfxFileAdapter } from '../OfxFileAdapter.js'
import { OfxParseError } from '../OfxParseError.js'

const fixturesDir = resolve(__dirname, '../../fixtures')

function loadFixture(name: string): Buffer {
  return readFileSync(join(fixturesDir, name))
}

describe('OfxFileAdapter', () => {
  describe('itau_with_fitid.ofx', () => {
    it('uses FITID as externalId and produces no warnings', async () => {
      const adapter = new OfxFileAdapter(loadFixture('itau_with_fitid.ofx'))
      const result = await adapter.fetch({})

      expect(result.transactions).toHaveLength(3)
      expect(result.transactions[0]!.externalId).toBe('ITAU-2024-001')
      expect(result.transactions[1]!.externalId).toBe('ITAU-2024-002')
      expect(result.transactions[2]!.externalId).toBe('ITAU-2024-003')
      expect(result.warnings).toHaveLength(0)
    })

    it('inverts OFX sign: negative TRNAMT → positive amountCents (expense)', async () => {
      const adapter = new OfxFileAdapter(loadFixture('itau_with_fitid.ofx'))
      const result = await adapter.fetch({})

      // -150.00 → +15000¢ (outflow, expense)
      expect(result.transactions[0]!.amountCents).toBe(15000)
      // -45.90 → +4590¢
      expect(result.transactions[1]!.amountCents).toBe(4590)
      // +5000.00 → -500000¢ (inflow, credit)
      expect(result.transactions[2]!.amountCents).toBe(-500000)
    })

    it('parses institution name from FI.ORG', async () => {
      const adapter = new OfxFileAdapter(loadFixture('itau_with_fitid.ofx'))
      const result = await adapter.fetch({})
      expect(result.transactions[0]!.sourceInstitution).toBe('Itau')
    })

    it('parses effectiveRange from DTSTART/DTEND', async () => {
      const adapter = new OfxFileAdapter(loadFixture('itau_with_fitid.ofx'))
      const result = await adapter.fetch({})
      expect(result.effectiveRange.from.getUTCFullYear()).toBe(2024)
      expect(result.effectiveRange.from.getUTCMonth()).toBe(0) // January
      expect(result.effectiveRange.to.getUTCDate()).toBe(31)
    })
  })

  describe('itau_without_fitid.ofx', () => {
    it('generates hash-based externalId and adds warning when FITID absent', async () => {
      const adapter = new OfxFileAdapter(loadFixture('itau_without_fitid.ofx'))
      const result = await adapter.fetch({})

      expect(result.transactions).toHaveLength(2)
      // externalIds should be 64-char hex hashes
      expect(result.transactions[0]!.externalId).toMatch(/^[0-9a-f]{64}$/)
      expect(result.transactions[1]!.externalId).toMatch(/^[0-9a-f]{64}$/)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toMatch(/FITID absent for 2 transaction/)
    })

    it('produces identical externalIds when parsed twice (determinism)', async () => {
      const buf = loadFixture('itau_without_fitid.ofx')
      const r1 = await new OfxFileAdapter(buf).fetch({})
      const r2 = await new OfxFileAdapter(buf).fetch({})

      expect(r1.transactions[0]!.externalId).toBe(r2.transactions[0]!.externalId)
      expect(r1.transactions[1]!.externalId).toBe(r2.transactions[1]!.externalId)
    })
  })

  describe('error handling', () => {
    it('throws OfxParseError for invalid buffer', async () => {
      const adapter = new OfxFileAdapter(Buffer.from('NOT VALID OFX DATA AT ALL %%%'))
      await expect(adapter.fetch({})).rejects.toBeInstanceOf(OfxParseError)
    })
  })
})

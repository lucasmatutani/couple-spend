import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { CsvFileAdapter, ITAU_MAPPING, PICPAY_MAPPING } from '../CsvFileAdapter.js'

const fixturesDir = resolve(__dirname, '../../fixtures')

function loadFixture(name: string): Buffer {
  return readFileSync(join(fixturesDir, name))
}

describe('CsvFileAdapter', () => {
  describe('itau.csv', () => {
    it('parses BR date format DD/MM/YYYY correctly', async () => {
      const adapter = new CsvFileAdapter(loadFixture('itau.csv'), ITAU_MAPPING, 'Itaú')
      const result = await adapter.fetch({})

      expect(result.transactions[0]!.occurredAt.getUTCFullYear()).toBe(2024)
      expect(result.transactions[0]!.occurredAt.getUTCMonth()).toBe(0) // January
      expect(result.transactions[0]!.occurredAt.getUTCDate()).toBe(10)
    })

    it('parses BR amount format (1.234,56) correctly', async () => {
      const adapter = new CsvFileAdapter(loadFixture('itau.csv'), ITAU_MAPPING, 'Itaú')
      const result = await adapter.fetch({})

      // -150,00 → inverted → +15000¢ (expense)
      expect(result.transactions[0]!.amountCents).toBe(15000)
      // 5.000,00 → inverted → -500000¢ (income/credit)
      expect(result.transactions[2]!.amountCents).toBe(-500000)
    })

    it('produces deterministic externalIds (same file parsed twice)', async () => {
      const buf = loadFixture('itau.csv')
      const r1 = await new CsvFileAdapter(buf, ITAU_MAPPING, 'Itaú').fetch({})
      const r2 = await new CsvFileAdapter(buf, ITAU_MAPPING, 'Itaú').fetch({})

      for (let i = 0; i < r1.transactions.length; i++) {
        expect(r1.transactions[i]!.externalId).toBe(r2.transactions[i]!.externalId)
      }
    })

    it('externalIds are 64-char hex hashes', async () => {
      const adapter = new CsvFileAdapter(loadFixture('itau.csv'), ITAU_MAPPING, 'Itaú')
      const result = await adapter.fetch({})
      for (const tx of result.transactions) {
        expect(tx.externalId).toMatch(/^[0-9a-f]{64}$/)
      }
    })
  })

  describe('picpay_with_bom.csv', () => {
    it('strips BOM and parses correctly', async () => {
      const adapter = new CsvFileAdapter(loadFixture('picpay_with_bom.csv'), PICPAY_MAPPING, 'PicPay')
      const result = await adapter.fetch({})

      expect(result.transactions).toHaveLength(2)
      expect(result.transactions[0]!.description).toBe('PIX Enviado - Fulano')
      expect(result.warnings.filter((w) => w.includes('BOM') || w.includes('column'))).toHaveLength(0)
    })
  })

  describe('invalid.csv', () => {
    it('skips invalid rows and emits warnings, does not crash', async () => {
      const adapter = new CsvFileAdapter(loadFixture('invalid.csv'), ITAU_MAPPING, 'Test')
      const result = await adapter.fetch({})

      // Only the valid row should be parsed
      expect(result.transactions).toHaveLength(1)
      expect(result.transactions[0]!.description).toBe('Valid Transaction')
      // Warnings for the 2 invalid rows
      expect(result.warnings.length).toBeGreaterThanOrEqual(2)
    })
  })
})

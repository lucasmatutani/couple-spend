import { describe, it, expect, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { PdfInvoiceAdapter, PdfExtractionError } from '../PdfInvoiceAdapter'

const fakePdfBuffer = Buffer.from('fake-pdf-content')

function makeClient(responseText: string): Anthropic {
  const finalMessage = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: responseText }],
    usage: { input_tokens: 100, output_tokens: 50 },
    stop_reason: 'end_turn',
  })
  return {
    messages: {
      stream: vi.fn().mockReturnValue({ finalMessage }),
    },
  } as unknown as Anthropic
}

const baseTransaction = {
  occurredAt: '2024-01-15',
  description: 'Coffee Shop',
  amountCents: 1500,
  type: 'expense' as const,
  installment: null,
}

const baseResponse = {
  institution: 'Test Bank',
  statementPeriod: { from: '2024-01-01', to: '2024-01-31' },
  transactions: [baseTransaction],
  warnings: [],
}

describe('PdfInvoiceAdapter', () => {
  it('maps expense to positive amountCents (ADR-003)', async () => {
    const adapter = new PdfInvoiceAdapter(
      fakePdfBuffer,
      makeClient(JSON.stringify(baseResponse)),
    )
    const result = await adapter.fetch({})
    expect(result.transactions[0]!.amountCents).toBe(1500)
  })

  it('maps income to negative amountCents (ADR-003)', async () => {
    const response = {
      ...baseResponse,
      transactions: [{ ...baseTransaction, type: 'income' as const, amountCents: 2000 }],
    }
    const adapter = new PdfInvoiceAdapter(fakePdfBuffer, makeClient(JSON.stringify(response)))
    const result = await adapter.fetch({})
    expect(result.transactions[0]!.amountCents).toBe(-2000)
  })

  it('produces same externalId for same transaction (determinism)', async () => {
    const adapter1 = new PdfInvoiceAdapter(fakePdfBuffer, makeClient(JSON.stringify(baseResponse)))
    const adapter2 = new PdfInvoiceAdapter(fakePdfBuffer, makeClient(JSON.stringify(baseResponse)))
    const [r1, r2] = await Promise.all([adapter1.fetch({}), adapter2.fetch({})])
    expect(r1.transactions[0]!.externalId).toBe(r2.transactions[0]!.externalId)
  })

  it('throws PdfExtractionError when response is not valid JSON', async () => {
    const adapter = new PdfInvoiceAdapter(fakePdfBuffer, makeClient('not json at all'))
    await expect(adapter.fetch({})).rejects.toBeInstanceOf(PdfExtractionError)
  })

  it('throws PdfExtractionError when schema validation fails', async () => {
    const invalid = JSON.stringify({ institution: 'X', transactions: [{ bad: true }] })
    const adapter = new PdfInvoiceAdapter(fakePdfBuffer, makeClient(invalid))
    await expect(adapter.fetch({})).rejects.toBeInstanceOf(PdfExtractionError)
  })

  it('propagates warnings from Claude response to FetchResult', async () => {
    const response = {
      ...baseResponse,
      warnings: ['Illegible date on row 3', 'Ambiguous amount'],
    }
    const adapter = new PdfInvoiceAdapter(fakePdfBuffer, makeClient(JSON.stringify(response)))
    const result = await adapter.fetch({})
    expect(result.warnings).toEqual(['Illegible date on row 3', 'Ambiguous amount'])
  })

  it('strips markdown code fence from response before parsing', async () => {
    const fenced = '```json\n' + JSON.stringify(baseResponse) + '\n```'
    const adapter = new PdfInvoiceAdapter(fakePdfBuffer, makeClient(fenced))
    const result = await adapter.fetch({})
    expect(result.transactions).toHaveLength(1)
  })

  it('stores installment in metadata', async () => {
    const response = {
      ...baseResponse,
      transactions: [
        { ...baseTransaction, installment: { current: 3, total: 12 } },
      ],
    }
    const adapter = new PdfInvoiceAdapter(fakePdfBuffer, makeClient(JSON.stringify(response)))
    const result = await adapter.fetch({})
    const meta = result.transactions[0]!.metadata as { installment: unknown }
    expect(meta.installment).toEqual({ current: 3, total: 12 })
  })

  it('uses institutionHint over extracted institution when provided', async () => {
    const adapter = new PdfInvoiceAdapter(
      fakePdfBuffer,
      makeClient(JSON.stringify(baseResponse)),
      'Itaú',
    )
    const result = await adapter.fetch({})
    expect(result.transactions[0]!.sourceInstitution).toBe('Itaú')
  })
})

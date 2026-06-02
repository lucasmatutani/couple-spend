import Anthropic from '@anthropic-ai/sdk'
import { createHash } from 'node:crypto'
import type {
  TransactionSource,
  FetchParams,
  FetchResult,
  RawTransaction,
} from '@splitwise/import-core'
import { buildUnifiedPrompt, type CategoryDef } from './prompt'
import { ExtractionResultSchema } from './schemas'

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfExtractionError'
  }
}

export class PdfInvoiceAdapter implements TransactionSource {
  readonly id = 'pdf-invoice'
  readonly displayName = 'PDF Invoice / Bank Statement'

  constructor(
    private readonly pdfBuffer: Buffer,
    private readonly client: Anthropic,
    private readonly institutionHint?: string,
    private readonly categories: CategoryDef[] = [],
  ) {}

  async fetch(_params: FetchParams): Promise<FetchResult> {
    const stream = this.client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 32000,
      system: [
        {
          type: 'text',
          text: buildUnifiedPrompt(this.categories),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: this.pdfBuffer.toString('base64'),
              },
            },
            { type: 'text', text: 'Extract all transactions from this document.' },
          ] as Anthropic.ContentBlockParam[],
        },
      ],
    })

    const message = await stream.finalMessage()

    console.log('[PdfInvoiceAdapter] stop_reason:', message.stop_reason)
    console.log('[PdfInvoiceAdapter] usage:', JSON.stringify(message.usage))
    console.log('[PdfInvoiceAdapter] content blocks:', message.content.map((c) => c.type))

    const textBlock = message.content.find(
      (c): c is Anthropic.TextBlock => c.type === 'text',
    )
    if (!textBlock) {
      throw new PdfExtractionError('No text content returned by Claude.')
    }

    console.log('[PdfInvoiceAdapter] raw text length:', textBlock.text.length)
    console.log('[PdfInvoiceAdapter] raw text:', textBlock.text)

    let parsed: unknown
    try {
      parsed = JSON.parse(textBlock.text.replace(/^```json\n?|\n?```$/g, '').trim())
    } catch {
      throw new PdfExtractionError(
        `Response was not valid JSON: ${textBlock.text.slice(0, 200)}`,
      )
    }

    const result = ExtractionResultSchema.safeParse(parsed)
    if (!result.success) {
      throw new PdfExtractionError(
        `Schema validation failed: ${result.error.message}`,
      )
    }

    const { institution, statementPeriod, transactions, warnings } = result.data

    // Count occurrences of each base hash so identical transactions get distinct externalIds.
    const hashCount = new Map<string, number>()

    return {
      transactions: transactions.map((t): RawTransaction => {
        const base = createHash('sha256')
          .update(`${t.occurredAt}|${t.amountCents}|${t.description.toLowerCase().trim()}`)
          .digest('hex')
        const n = hashCount.get(base) ?? 0
        hashCount.set(base, n + 1)
        const externalId = n === 0
          ? base
          : createHash('sha256').update(`${base}|${n}`).digest('hex')

        return {
          externalId,
          occurredAt: new Date(t.occurredAt),
          amountCents: t.type === 'expense' ? t.amountCents : -t.amountCents,
          description: t.description,
          currency: 'BRL',
          sourceInstitution: this.institutionHint ?? institution,
          rawType: t.type === 'expense' ? 'DEBIT' : 'CREDIT',
          metadata: {
            extractedBy: 'claude-sonnet-4-6',
            installment: t.installment,
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            ...(t.categoryId ? { suggestedCategoryId: t.categoryId, categoryConfidence: t.confidence ?? 0 } : {}),
          },
        }
      }),
      effectiveRange: {
        from: new Date(statementPeriod.from),
        to: new Date(statementPeriod.to),
      },
      warnings,
    }
  }
}

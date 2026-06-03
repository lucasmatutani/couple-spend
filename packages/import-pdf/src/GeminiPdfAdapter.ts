import { GoogleGenAI } from '@google/genai'
import { createHash } from 'node:crypto'
import type {
  TransactionSource,
  FetchParams,
  FetchResult,
  RawTransaction,
} from '@splitwise/import-core'
import { buildUnifiedPrompt, type CategoryDef } from './prompt'
import { ExtractionResultSchema } from './schemas'

export class GeminiPdfExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GeminiPdfExtractionError'
  }
}

export class GeminiPdfAdapter implements TransactionSource {
  readonly id = 'pdf-invoice'
  readonly displayName = 'PDF Invoice (Gemini)'

  constructor(
    private readonly pdfBuffer: Buffer,
    private readonly client: GoogleGenAI,
    private readonly institutionHint?: string,
    private readonly categories: CategoryDef[] = [],
  ) {}

  async fetch(_params: FetchParams): Promise<FetchResult> {
    const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-preview-05-20'
    const prompt = buildUnifiedPrompt(this.categories)

    // Upload the PDF via Files API — avoids base64 inline and supports larger files.
    const uploadedFile = await this.client.files.upload({
      file: new Blob([this.pdfBuffer], { type: 'application/pdf' }),
      config: { mimeType: 'application/pdf', displayName: 'invoice.pdf' },
    })

    console.log('[GeminiPdfAdapter] file uploaded:', uploadedFile.name, uploadedFile.uri)

    let text = ''
    let inputTokens: number | undefined
    let outputTokens: number | undefined

    try {
      const response = await this.client.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              {
                fileData: {
                  mimeType: 'application/pdf',
                  fileUri: uploadedFile.uri!,
                },
              },
            ],
          },
        ],
      })

      text = response.text ?? ''
      inputTokens = response.usageMetadata?.promptTokenCount
      outputTokens = response.usageMetadata?.candidatesTokenCount
    } finally {
      // Always clean up the uploaded file.
      if (uploadedFile.name) {
        await this.client.files.delete({ name: uploadedFile.name }).catch(() => undefined)
        console.log('[GeminiPdfAdapter] file deleted:', uploadedFile.name)
      }
    }

    console.log('[GeminiPdfAdapter] model:', modelName)
    console.log('[GeminiPdfAdapter] usage — input:', inputTokens, 'output:', outputTokens)
    console.log('[GeminiPdfAdapter] response length:', text.length)

    let parsed: unknown
    try {
      parsed = JSON.parse(text.replace(/^```json\n?|\n?```$/g, '').trim())
    } catch {
      throw new GeminiPdfExtractionError(
        `Response was not valid JSON: ${text.slice(0, 200)}`,
      )
    }

    const validated = ExtractionResultSchema.safeParse(parsed)
    if (!validated.success) {
      throw new GeminiPdfExtractionError(
        `Schema validation failed: ${validated.error.message}`,
      )
    }

    const { institution, statementPeriod, transactions, warnings } = validated.data
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
            extractedBy: modelName,
            installment: t.installment,
            inputTokens,
            outputTokens,
            ...(t.categoryId
              ? { suggestedCategoryId: t.categoryId, categoryConfidence: t.confidence ?? 0 }
              : {}),
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

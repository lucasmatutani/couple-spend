import { z } from 'zod'

export const ExtractionResultSchema = z.object({
  institution: z.string(),
  statementPeriod: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  transactions: z.array(
    z.object({
      occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      description: z.string().min(1),
      amountCents: z.number().int().positive(),
      type: z.enum(['expense', 'income']),
      installment: z.object({ current: z.number(), total: z.number() }).nullable(),
    }),
  ),
  warnings: z.array(z.string()),
})

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>

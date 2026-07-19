'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toCategoryId, toHouseholdId, toUserId, YearMonth } from '@splitwise/domain'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { getImportRepository } from '@/lib/container'
import { checkCanImportMonth, PlanLimitError } from '@/lib/plan-guard'
import { PdfExtractionError, GeminiPdfExtractionError } from '@splitwise/import-pdf'
import { getPdfSource } from '@/lib/import-sources'
import { buildCategoryResolver } from '@/lib/resolvers'
import { upsertCreditCardHouseholdSplit } from '@/lib/cc-split'
import type { ImportPreview, ReviewRow } from './types'

type ProcessResult =
  | { success: true; preview: ImportPreview }
  | { success: false; error: string }

async function getKeywordsByKind(
  supabase: SupabaseClient,
  ownerId: string,
): Promise<{ sharedBillKeywords: string[]; fullRefundKeywords: string[] }> {
  const { data } = await supabase
    .from('shared_bill_keywords')
    .select('keyword, kind')
    .eq('owner_id', ownerId)
  const rows = (data ?? []) as { keyword: string; kind: 'split' | 'reimbursed' }[]
  return {
    sharedBillKeywords: rows.filter((r) => r.kind === 'split').map((r) => r.keyword),
    fullRefundKeywords: rows.filter((r) => r.kind === 'reimbursed').map((r) => r.keyword),
  }
}

async function getDefaultCategoryId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('name', 'Outros')
    .is('household_id', null)
    .single()
  if (!data?.id) throw new Error('Default category "Outros" not found in database.')
  return data.id as string
}

export async function processImport(formData: FormData): Promise<ProcessResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { success: false, error: 'Nenhum arquivo selecionado' }

  const household = await new SupabaseHouseholdRepository().findFirstByMember(toUserId(user.id))
  if (!household) return { success: false, error: 'Household não encontrado' }

  const householdId = household.id as string
  const ownerId = user.id

  try {
    await checkCanImportMonth(toUserId(user.id), YearMonth.current())
  } catch (err) {
    if (err instanceof PlanLimitError) return { success: false, error: 'plan_limit' }
    throw err
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase()

  const defaultCategoryId = await getDefaultCategoryId(supabase)

  const dryRunRepo = {
    existsByExternalId: async () => false,
    saveBatch: async () => {},
  }

  const resolver = await buildCategoryResolver(
    toHouseholdId(householdId),
    toUserId(ownerId),
    toCategoryId(defaultCategoryId),
  )

  const defaultPolicy = { apply: () => 'EQUAL' as const }
  const systemClock = { now: () => new Date() }

  const { ImportTransactionsUseCase } = await import('@splitwise/import-core')
  const useCase = new ImportTransactionsUseCase(dryRunRepo, resolver, defaultPolicy, systemClock)

  const allCategories = await new SupabaseCategoryRepository().findAll(toHouseholdId(householdId))
  const categoryDefs = allCategories.map((c) => ({ id: c.id as string, name: c.name, keywordsHint: c.keywordsHint }))

  const { sharedBillKeywords, fullRefundKeywords } = await getKeywordsByKind(supabase, ownerId)
  const source = getPdfSource(buffer, categoryDefs, sharedBillKeywords, fullRefundKeywords)

  try {
    const summary = await useCase.execute(source, {}, ownerId, householdId)

    let transactions = summary.importedTransactions

    if (ext === 'pdf') {
      // Apply category suggestions embedded in metadata by the unified prompt.
      transactions = transactions.map((t) => {
        if (t.categorySource !== 'default') return t
        const suggestedId = t.raw.metadata?.['suggestedCategoryId'] as string | undefined
        const confidence = t.raw.metadata?.['categoryConfidence'] as number | undefined
        if (suggestedId && typeof confidence === 'number' && confidence >= 0.5) {
          return { ...t, categoryId: suggestedId, categoryConfidence: confidence, categorySource: 'llm' as const }
        }
        return t
      })
    }

    const preview: ImportPreview = {
      transactions,
      warnings: summary.warnings,
      householdId,
    }
    return { success: true, preview }
  } catch (e) {
    if (e instanceof PdfExtractionError || e instanceof GeminiPdfExtractionError) return { success: false, error: e.message }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao processar arquivo' }
  }
}

const PT_MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function formatMonthLabel(occurredAt: string): string {
  const [y, m] = occurredAt.split('-') as [string, string]
  return `${PT_MONTHS[parseInt(m, 10) - 1]} de ${y}`
}

type ConfirmResult =
  | { success: true; imported: number; skipped: number; conflictMessage: string | undefined }
  | { success: false; error: string }

export async function confirmImport(
  rows: ReviewRow[],
  householdId: string,
  targetMonth?: string, // "YYYY-MM" — when set, overrides billing date for PDF imports
): Promise<ConfirmResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const repo = getImportRepository()

  const included = rows.filter((r) => !r.excluded)
  let skipped = 0

  const toSave = []
  for (const row of included) {
    // PDF imports are always replaced in full (delete + insert), so skip the duplicate check.
    if (row.sourceId !== 'pdf-invoice') {
      const isDuplicate = await repo.existsByExternalId(row.externalId, row.sourceId, householdId)
      if (isDuplicate) { skipped++; continue }
    }

    toSave.push({
      ownerId: user.id,
      householdId,
      sourceId: row.sourceId,
      raw: {
        externalId: row.externalId,
        occurredAt: new Date(row.occurredAt),
        amountCents: row.amountCents,
        description: row.description,
        currency: 'BRL' as const,
        sourceInstitution: 'Importado',
        // isSharedBill/isFullyReimbursed were flagged by the LLM in processImport and travel
        // with the ReviewRow (client round-trip loses everything not on that type) — carry
        // them back into raw.metadata so savePersonalBatch can read them.
        metadata: { isSharedBill: row.isSharedBill ?? false, isFullyReimbursed: row.isFullyReimbursed ?? false },
      },
      categoryId: row.categoryId,
      categoryConfidence: row.categoryConfidence,
      categorySource: row.categorySource,
      splitRule: row.splitRule as 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM',
      importedAt: new Date(),
    })
  }

  let pdfInserted = 0
  let conflictMonth: string | null = null
  const pdfRows = toSave.filter((t) => t.sourceId === 'pdf-invoice')
  const sharedRows = toSave.filter((t) => t.sourceId !== 'pdf-invoice')

  if (toSave.length > 0) {

    if (pdfRows.length > 0) {
      // PDF invoice imports are personal credit card expenses; everything else goes to shared expenses.
      // Negative amountCents = credit/refund on the statement. Override categoryId to "Reembolsos"
      // so the card can display them as credits that reduce the total.
      const { data: refundCat } = await supabase
        .from('categories')
        .select('id')
        .eq('name', 'Reembolsos')
        .is('household_id', null)
        .single()

      const refundCategoryId = refundCat?.id as string | undefined

      const normalizedPdfRows = pdfRows.map((t) =>
        t.raw.amountCents < 0 && refundCategoryId
          ? { ...t, categoryId: refundCategoryId }
          : t,
      )

      // Billing month: use the explicit targetMonth from the URL when provided,
      // otherwise fall back to the latest transaction date in the statement.
      let billingOccurredAt: string
      if (targetMonth) {
        billingOccurredAt = `${targetMonth}-01`
      } else {
        const latestDate = normalizedPdfRows.reduce<Date>(
          (max, t) => (t.raw.occurredAt > max ? t.raw.occurredAt : max),
          normalizedPdfRows[0]!.raw.occurredAt,
        )
        billingOccurredAt = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}-01`
      }
      const pdfResult = await repo.savePersonalBatch(normalizedPdfRows, 'credit_card', billingOccurredAt)
      pdfInserted = pdfResult.inserted
      if (pdfResult.conflictMonth) {
        conflictMonth = pdfResult.conflictMonth
      }

      // Auto-split recurring bills recognized via keywords registered in
      // Settings > Contas fixas compartilhadas — mirror into the household ledger
      // just like a manual "Dividir com o parceiro" edit would.
      const pdfReviewRowsByExternalId = new Map(
        included.filter((r) => r.sourceId === 'pdf-invoice').map((r) => [r.externalId, r]),
      )
      const sharedBillInserts = pdfResult.insertedRows
        .map((ir) => ({ ir, row: pdfReviewRowsByExternalId.get(ir.externalId) }))
        .filter((x): x is { ir: { id: string; externalId: string }; row: ReviewRow } =>
          !!x.row?.isSharedBill && !x.row.isFullyReimbursed && x.row.amountCents > 0)

      await Promise.all(
        sharedBillInserts.map(({ ir, row }) =>
          upsertCreditCardHouseholdSplit(supabase, {
            personalExpenseId: ir.id,
            householdId,
            paidBy: user.id,
            categoryId: row.categoryId,
            occurredAt: billingOccurredAt,
            amountCents: Math.abs(row.amountCents),
            description: row.description || null,
          }),
        ),
      )
    }

    if (sharedRows.length > 0) {
      await repo.saveBatch(sharedRows)
    }
  }

  const imported = pdfInserted + sharedRows.length
  const pdfSkipped = pdfRows.length - pdfInserted
  const totalSkipped = skipped + (rows.length - included.length) + pdfSkipped

  let conflictMessage: string | undefined
  if (pdfSkipped > 0 && conflictMonth) {
    const n = pdfSkipped
    conflictMessage = `${n} transaç${n === 1 ? 'ão já estava importada' : 'ões já estavam importadas'} em ${formatMonthLabel(conflictMonth)} e não ${n === 1 ? 'foi movida' : 'foram movidas'}. Para movê-las, remova a fatura daquele mês primeiro.`
  }

  revalidatePath('/dashboard/individual')
  revalidatePath('/dashboard/household')
  return { success: true, imported, skipped: totalSkipped, conflictMessage }
}

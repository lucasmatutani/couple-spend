'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toCategoryId, toHouseholdId, toUserId, YearMonth } from '@splitwise/domain'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { getImportRepository } from '@/lib/container'
import { checkCanImportMonth, PlanLimitError } from '@/lib/plan-guard'
import { OfxFileAdapter } from '@splitwise/import-ofx'
import { CsvFileAdapter, ITAU_MAPPING, PICPAY_MAPPING } from '@splitwise/import-csv'
import type { CsvColumnMapping } from '@splitwise/import-csv'
import { PdfExtractionError } from '@splitwise/import-pdf'
import { getOpenFinanceSource, getPdfSource } from '@/lib/import-sources'
import { buildCategoryResolver } from '@/lib/resolvers'
import { batchCategorize } from '@/lib/llm-categorizer'
import { getAnthropicClient } from '@/lib/anthropic'
import type { ImportPreview, ReviewRow } from './types'

type ProcessResult =
  | { success: true; preview: ImportPreview }
  | { success: false; error: string }

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

  let mapping = formData.get('mapping') as string | null
  const columnMapping: CsvColumnMapping =
    mapping === 'picpay' ? PICPAY_MAPPING :
    mapping === 'itau' ? ITAU_MAPPING :
    ITAU_MAPPING

  const source =
    ext === 'pdf'
      ? getPdfSource(buffer)
      : ext === 'ofx'
        ? new OfxFileAdapter(buffer)
        : new CsvFileAdapter(buffer, columnMapping, 'Importado')

  try {
    const summary = await useCase.execute(source, {}, ownerId, householdId)

    let transactions = summary.importedTransactions

    // LLM post-processing: batch-categorize transactions the chain couldn't resolve
    if (process.env.ENABLE_LLM_CATEGORIZATION === 'true') {
      const uncategorized = transactions.filter((t) => t.categorySource === 'default')
      if (uncategorized.length > 0) {
        try {
          const allCategories = await new SupabaseCategoryRepository().findAll(toHouseholdId(householdId))
          const categoryDefs = allCategories.map((c) => ({ id: c.id as string, name: c.name }))
          const llmMap = await batchCategorize(
            uncategorized.map((t) => ({ externalId: t.raw.externalId, description: t.raw.description })),
            categoryDefs,
            getAnthropicClient(),
          )
          transactions = transactions.map((t) => {
            const llm = llmMap.get(t.raw.externalId)
            if (llm && llm.confidence >= 0.5) {
              return { ...t, categoryId: llm.categoryId, categoryConfidence: llm.confidence, categorySource: 'llm' as const }
            }
            return t
          })
        } catch (err) {
          // LLM failure is non-fatal — chain results are still usable
          console.warn('[LLM Categorization] Failed, using chain results:', err)
        }
      }
    }

    const preview: ImportPreview = {
      transactions,
      warnings: summary.warnings,
      householdId,
    }
    return { success: true, preview }
  } catch (e) {
    if (e instanceof PdfExtractionError) return { success: false, error: e.message }
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao processar arquivo' }
  }
}

type ConfirmResult = { success: true; imported: number; skipped: number } | { success: false; error: string }

export async function confirmImport(rows: ReviewRow[], householdId: string): Promise<ConfirmResult> {
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
      },
      categoryId: row.categoryId,
      categoryConfidence: row.categoryConfidence,
      categorySource: row.categorySource,
      splitRule: row.splitRule as 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM',
      importedAt: new Date(),
    })
  }

  if (toSave.length > 0) {
    // PDF invoice imports are personal credit card expenses; everything else goes to shared expenses.
    const pdfRows = toSave.filter((t) => t.sourceId === 'pdf-invoice')
    const sharedRows = toSave.filter((t) => t.sourceId !== 'pdf-invoice')

    if (pdfRows.length > 0) {
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

      // All transactions from a credit card statement belong to the billing month,
      // which is the month of the latest transaction in the statement.
      const latestDate = normalizedPdfRows.reduce<Date>(
        (max, t) => (t.raw.occurredAt > max ? t.raw.occurredAt : max),
        normalizedPdfRows[0]!.raw.occurredAt,
      )
      const billingOccurredAt = `${latestDate.getFullYear()}-${String(latestDate.getMonth() + 1).padStart(2, '0')}-01`
      await repo.savePersonalBatch(normalizedPdfRows, 'credit_card', billingOccurredAt)
    }

    if (sharedRows.length > 0) {
      await repo.saveBatch(sharedRows)
    }
  }

  revalidatePath('/dashboard/individual')
  revalidatePath('/dashboard/household')
  revalidatePath('/dashboard/import')
  return { success: true, imported: toSave.length, skipped: skipped + (rows.length - included.length) }
}

export async function importFromConnectedAccount(accountId: string): Promise<ProcessResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  try {
    await checkCanImportMonth(toUserId(user.id), YearMonth.current())
  } catch (err) {
    if (err instanceof PlanLimitError) return { success: false, error: 'plan_limit' }
    throw err
  }

  const { data: account } = await supabase
    .from('connected_accounts')
    .select('provider_item_id, institution_name')
    .eq('id', accountId)
    .single()
  if (!account) return { success: false, error: 'Conta conectada não encontrada' }

  const household = await new SupabaseHouseholdRepository().findFirstByMember(toUserId(user.id))
  if (!household) return { success: false, error: 'Household não encontrado' }

  const householdId = household.id as string
  const ownerId = user.id

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

  const source = getOpenFinanceSource(account.provider_item_id, account.institution_name)

  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)

  try {
    const summary = await useCase.execute(source, { dateRange: { from, to } }, ownerId, householdId)

    let transactions = summary.importedTransactions

    if (process.env.ENABLE_LLM_CATEGORIZATION === 'true') {
      const uncategorized = transactions.filter((t) => t.categorySource === 'default')
      if (uncategorized.length > 0) {
        try {
          const allCategories = await new SupabaseCategoryRepository().findAll(toHouseholdId(householdId))
          const categoryDefs = allCategories.map((c) => ({ id: c.id as string, name: c.name }))
          const llmMap = await batchCategorize(
            uncategorized.map((t) => ({ externalId: t.raw.externalId, description: t.raw.description })),
            categoryDefs,
            getAnthropicClient(),
          )
          transactions = transactions.map((t) => {
            const llm = llmMap.get(t.raw.externalId)
            if (llm && llm.confidence >= 0.5) {
              return { ...t, categoryId: llm.categoryId, categoryConfidence: llm.confidence, categorySource: 'llm' as const }
            }
            return t
          })
        } catch (err) {
          console.warn('[LLM Categorization] Failed, using chain results:', err)
        }
      }
    }

    const preview: ImportPreview = {
      transactions,
      warnings: summary.warnings,
      householdId,
    }
    return { success: true, preview }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao buscar transações' }
  }
}

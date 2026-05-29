'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { toHouseholdId, toUserId, YearMonth } from '@splitwise/domain'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { getImportUseCase, getImportRepository } from '@/lib/container'
import { checkCanImportMonth, PlanLimitError } from '@/lib/plan-guard'
import { OfxFileAdapter } from '@splitwise/import-ofx'
import { CsvFileAdapter, ITAU_MAPPING, PICPAY_MAPPING } from '@splitwise/import-csv'
import type { CsvColumnMapping } from '@splitwise/import-csv'
import { PdfExtractionError } from '@splitwise/import-pdf'
import { getOpenFinanceSource, getPdfSource } from '@/lib/import-sources'
import type { ImportPreview, ReviewRow } from './types'

async function getDefaultCategoryId(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from('categories')
    .select('id')
    .eq('name', 'Other')
    .is('household_id', null)
    .single()
  if (!data?.id) throw new Error('Default category "Other" not found in database.')
  return data.id as string
}

type ProcessResult =
  | { success: true; preview: ImportPreview }
  | { success: false; error: string }

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
    if (err instanceof PlanLimitError) {
      return { success: false, error: 'plan_limit' }
    }
    throw err
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase()

  const defaultCategoryId = await getDefaultCategoryId(supabase)

  const dryRunRepo = {
    existsByExternalId: async () => false,
    saveBatch: async () => {},
  }

  const defaultResolver = {
    resolve: async () => ({ categoryId: defaultCategoryId, confidence: 0.1, source: 'default' as const }),
  }
  const defaultPolicy = { apply: () => 'EQUAL' as const }
  const systemClock = { now: () => new Date() }

  const { ImportTransactionsUseCase } = await import('@splitwise/import-core')
  const useCase = new ImportTransactionsUseCase(dryRunRepo, defaultResolver, defaultPolicy, systemClock)

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
    const preview: ImportPreview = {
      transactions: summary.importedTransactions,
      warnings: summary.warnings,
      householdId,
    }
    return { success: true, preview }
  } catch (e) {
    if (e instanceof PdfExtractionError) {
      return { success: false, error: e.message }
    }
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
    const isDuplicate = await repo.existsByExternalId(row.externalId, row.sourceId, householdId)
    if (isDuplicate) { skipped++; continue }

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
    await repo.saveBatch(toSave)
  }

  revalidatePath('/dashboard/household')
  revalidatePath('/dashboard/import')
  return { success: true, imported: toSave.length, skipped: skipped + (rows.length - included.length) }
}

export async function importFromConnectedAccount(accountId: string): Promise<ProcessResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  const defaultResolver = {
    resolve: async () => ({ categoryId: defaultCategoryId, confidence: 0.1, source: 'default' as const }),
  }
  const defaultPolicy = { apply: () => 'EQUAL' as const }
  const systemClock = { now: () => new Date() }

  const { ImportTransactionsUseCase } = await import('@splitwise/import-core')
  const useCase = new ImportTransactionsUseCase(dryRunRepo, defaultResolver, defaultPolicy, systemClock)

  const source = getOpenFinanceSource(account.provider_item_id, account.institution_name)

  const to = new Date()
  const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)

  try {
    const summary = await useCase.execute(source, { dateRange: { from, to } }, ownerId, householdId)
    const preview: ImportPreview = {
      transactions: summary.importedTransactions,
      warnings: summary.warnings,
      householdId,
    }
    return { success: true, preview }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Erro ao buscar transações' }
  }
}

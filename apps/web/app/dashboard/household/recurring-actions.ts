'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import {
  Expense,
  Money,
  SplitRule,
  toCategoryId,
  toExpenseId,
  toHouseholdId,
  toUserId,
} from '@splitwise/domain'
import { SupabaseExpenseRepository } from '@/lib/repositories/SupabaseExpenseRepository'

type ActionResult = { success: true } | { success: false; error: string }

const addSchema = z.object({
  householdId: z.string().min(1),
  categoryId: z.string().min(1),
  amountCents: z.number().int().positive(),
  description: z.string().min(1),
  splitRuleType: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
  splitRulePayerPercent: z.number().min(0).max(100).nullable(),
  installmentCount: z.number().int().min(1).nullable(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/),
})

function buildSplitRule(type: string, payerPercent: number | null): SplitRule {
  switch (type) {
    case 'ONLY_PAYER': return SplitRule.onlyPayer()
    case 'ONLY_OTHER': return SplitRule.onlyOther()
    case 'CUSTOM':     return SplitRule.custom(payerPercent!)
    default:           return SplitRule.equal()
  }
}

// Returns the months to generate entries for, starting from startMonth.
// installmentCount=null → startMonth through December of startMonth's year
// installmentCount=n    → exactly n months starting from startMonth
function monthsToGenerate(
  installmentCount: number | null,
  startMonth: string, // "YYYY-MM"
): { year: number; month: number }[] {
  const [yearStr, monthStr] = startMonth.split('-')
  const startYear = parseInt(yearStr!, 10)
  const startMonthNum = parseInt(monthStr!, 10) // 1-indexed
  const result = []
  if (installmentCount !== null) {
    for (let i = 0; i < installmentCount; i++) {
      const d = new Date(startYear, startMonthNum - 1 + i, 1)
      result.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    }
  } else {
    for (let m = startMonthNum; m <= 12; m++) {
      result.push({ year: startYear, month: m })
    }
  }
  return result
}

export async function addRecurringExpense(input: unknown): Promise<ActionResult> {
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data

  // 1. Insert template
  const { data: template, error: tmplErr } = await supabase
    .from('recurring_expenses')
    .insert({
      household_id: d.householdId,
      paid_by: user.id,
      category_id: d.categoryId,
      amount_cents: d.amountCents,
      description: d.description,
      split_rule_type: d.splitRuleType,
      split_rule_payer_percent: d.splitRulePayerPercent ?? null,
      installment_count: d.installmentCount ?? null,
    })
    .select('id')
    .single()

  if (tmplErr || !template) return { success: false, error: 'Erro ao criar despesa fixa' }

  // 2. Auto-generate one expense entry per month
  const splitRule = buildSplitRule(d.splitRuleType, d.splitRulePayerPercent)
  const repo = new SupabaseExpenseRepository()

  for (const { year, month } of monthsToGenerate(d.installmentCount ?? null, d.startMonth)) {
    const mm = String(month).padStart(2, '0')
    const occurredAt = new Date(`${year}-${mm}-01T12:00:00`)
    const expense = Expense.create({
      id: toExpenseId(crypto.randomUUID()),
      householdId: toHouseholdId(d.householdId),
      paidBy: toUserId(user.id),
      categoryId: toCategoryId(d.categoryId),
      occurredAt,
      amount: Money.of(d.amountCents),
      description: d.description,
      splitRule,
      sourceId: 'recurring',
      // external_id encodes template + month for idempotency
      externalId: `${template.id}-${year}-${mm}`,
    })
    await repo.save(expense)

    // Link the generated entry back to the template and mark as recurring
    await supabase
      .from('expenses')
      .update({ recurring_expense_id: template.id, is_recurring: true })
      .eq('household_id', d.householdId)
      .eq('source_id', 'recurring')
      .eq('external_id', `${template.id}-${year}-${mm}`)
  }

  revalidatePath('/dashboard/household')
  return { success: true }
}

// Updates a recurring expense template and all future generated entries from the current month.
export async function updateRecurringExpenseTemplate(input: unknown): Promise<ActionResult> {
  const schema = z.object({
    id: z.string().min(1),
    categoryId: z.string().min(1),
    amountCents: z.number().int().positive(),
    description: z.string().min(1),
    splitRuleType: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
    splitRulePayerPercent: z.number().min(0).max(100).nullable(),
  })

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  const fromDate = `${new Date().toISOString().slice(0, 7)}-01` // YYYY-MM-01

  const { error: tmplErr } = await supabase.from('recurring_expenses').update({
    category_id: d.categoryId,
    amount_cents: d.amountCents,
    description: d.description,
    split_rule_type: d.splitRuleType,
    split_rule_payer_percent: d.splitRulePayerPercent ?? null,
  }).eq('id', d.id)

  if (tmplErr) return { success: false, error: 'Erro ao atualizar o template' }

  await supabase.from('expenses').update({
    category_id: d.categoryId,
    amount_cents: d.amountCents,
    description: d.description,
    split_rule_type: d.splitRuleType,
    split_rule_payer_percent: d.splitRulePayerPercent ?? null,
  }).eq('recurring_expense_id', d.id).gte('occurred_at', fromDate)

  revalidatePath('/dashboard/household')
  return { success: true }
}

// Updates only the generated entry for a specific month, decoupling it from the series.
export async function updateRecurringExpenseSingleMonth(input: unknown): Promise<ActionResult> {
  const schema = z.object({
    templateId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    categoryId: z.string().min(1),
    amountCents: z.number().int().positive(),
    description: z.string().min(1),
    splitRuleType: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
    splitRulePayerPercent: z.number().min(0).max(100).nullable(),
  })

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  const occurredAt = `${d.month}-01`

  const { error } = await supabase
    .from('expenses')
    .update({
      category_id: d.categoryId,
      amount_cents: d.amountCents,
      description: d.description,
      split_rule_type: d.splitRuleType,
      split_rule_payer_percent: d.splitRulePayerPercent ?? null,
      recurring_expense_id: null,
      is_recurring: true,
    })
    .eq('recurring_expense_id', d.templateId)
    .eq('occurred_at', occurredAt)

  if (error) return { success: false, error: 'Erro ao atualizar a despesa' }

  revalidatePath('/dashboard/household')
  return { success: true }
}

// Deactivates a template and removes all its generated entries from fromMonth onwards.
export async function deactivateRecurringTemplate(
  templateId: string,
  fromMonth: string, // "YYYY-MM"
): Promise<ActionResult> {
  if (!templateId || !/^\d{4}-\d{2}$/.test(fromMonth)) {
    return { success: false, error: 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const fromDate = `${fromMonth}-01`

  await supabase
    .from('expenses')
    .delete()
    .eq('recurring_expense_id', templateId)
    .gte('occurred_at', fromDate)

  const { error: deactivateErr } = await supabase
    .from('recurring_expenses')
    .update({ active: false })
    .eq('id', templateId)

  if (deactivateErr) return { success: false, error: 'Erro ao desativar o template' }

  revalidatePath('/dashboard/household')
  return { success: true }
}

// Deletes this entry + all future entries of the same recurring series.
export async function deleteExpenseFuture(
  recurringExpenseId: string,
  fromOccurredAt: string, // "YYYY-MM-DD"
): Promise<ActionResult> {
  if (!recurringExpenseId || !fromOccurredAt) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  await supabase
    .from('expenses')
    .delete()
    .eq('recurring_expense_id', recurringExpenseId)
    .gte('occurred_at', fromOccurredAt)

  // If no future entries remain, mark template inactive
  const { count } = await supabase
    .from('expenses')
    .select('*', { count: 'exact', head: true })
    .eq('recurring_expense_id', recurringExpenseId)

  if ((count ?? 0) === 0) {
    await supabase
      .from('recurring_expenses')
      .update({ active: false })
      .eq('id', recurringExpenseId)
  }

  revalidatePath('/dashboard/household')
  return { success: true }
}

// Updates only this specific entry and decouples it from the recurring series.
export async function updateExpenseSingle(input: unknown): Promise<ActionResult> {
  const schema = z.object({
    id: z.string().min(1),
    householdId: z.string().min(1),
    categoryId: z.string().min(1),
    occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    amountCents: z.number().int().positive(),
    description: z.string().nullable(),
    splitRuleType: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
    splitRulePayerPercent: z.number().min(0).max(100).nullable(),
  })

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  const expense = Expense.create({
    id: toExpenseId(d.id),
    householdId: toHouseholdId(d.householdId),
    paidBy: toUserId(user.id),
    categoryId: toCategoryId(d.categoryId),
    occurredAt: new Date(d.occurredAt),
    amount: Money.of(d.amountCents),
    description: d.description,
    splitRule: buildSplitRule(d.splitRuleType, d.splitRulePayerPercent),
    sourceId: 'manual',
    externalId: d.id,
  })

  await new SupabaseExpenseRepository().save(expense)

  // Decouple from recurring series so future bulk edits won't affect this entry,
  // but preserve is_recurring so the monthly total stays correct.
  await supabase
    .from('expenses')
    .update({ recurring_expense_id: null, is_recurring: true })
    .eq('id', d.id)

  revalidatePath('/dashboard/household')
  return { success: true }
}

// Updates this entry AND all future entries in the same recurring series.
export async function updateExpenseFuture(input: unknown): Promise<ActionResult> {
  const schema = z.object({
    id: z.string().min(1),
    householdId: z.string().min(1),
    recurringExpenseId: z.string().min(1),
    fromOccurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    categoryId: z.string().min(1),
    amountCents: z.number().int().positive(),
    description: z.string().nullable(),
    splitRuleType: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
    splitRulePayerPercent: z.number().min(0).max(100).nullable(),
  })

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data

  // Bulk update all future entries (each entry keeps its own occurred_at)
  await supabase
    .from('expenses')
    .update({
      category_id: d.categoryId,
      amount_cents: d.amountCents,
      description: d.description,
      split_rule_type: d.splitRuleType,
      split_rule_payer_percent: d.splitRulePayerPercent ?? null,
    })
    .eq('recurring_expense_id', d.recurringExpenseId)
    .gte('occurred_at', d.fromOccurredAt)

  // Also update the template so new months inherit the changes
  await supabase
    .from('recurring_expenses')
    .update({
      category_id: d.categoryId,
      amount_cents: d.amountCents,
      description: d.description,
      split_rule_type: d.splitRuleType,
      split_rule_payer_percent: d.splitRulePayerPercent ?? null,
    })
    .eq('id', d.recurringExpenseId)

  revalidatePath('/dashboard/household')
  return { success: true }
}

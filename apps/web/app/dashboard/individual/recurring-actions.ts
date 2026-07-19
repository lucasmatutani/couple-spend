'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Money, PersonalExpense, toCategoryId, toPersonalExpenseId, toUserId } from '@splitwise/domain'
import { getPersonalExpenseRepository } from '@/lib/container'

type ActionResult = { success: true } | { success: false; error: string }

const addSchema = z.object({
  categoryId: z.string().min(1),
  amountCents: z.number().int().positive(),
  description: z.string().min(1),
  installmentCount: z.number().int().min(1).nullable(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/),
})

function monthsToGenerate(startMonth: string, installmentCount: number | null): { year: number; month: number }[] {
  const [startYearStr, startMonthStr] = startMonth.split('-') as [string, string]
  const startYear = parseInt(startYearStr, 10)
  const startMonthIndex = parseInt(startMonthStr, 10) - 1
  const result = []
  if (installmentCount !== null) {
    for (let i = 0; i < installmentCount; i++) {
      const d = new Date(startYear, startMonthIndex + i, 1)
      result.push({ year: d.getFullYear(), month: d.getMonth() + 1 })
    }
  } else {
    for (let m = startMonthIndex; m <= 11; m++) {
      result.push({ year: startYear, month: m + 1 })
    }
  }
  return result
}

export async function addRecurringPersonalExpense(input: unknown): Promise<ActionResult> {
  const parsed = addSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data

  // 1. Insert template
  const { data: template, error: tmplErr } = await supabase
    .from('recurring_personal_expenses')
    .insert({
      owner_id: user.id,
      category_id: d.categoryId,
      amount_cents: d.amountCents,
      description: d.description,
      installment_count: d.installmentCount ?? null,
    })
    .select('id')
    .single()

  if (tmplErr || !template) return { success: false, error: 'Erro ao criar despesa fixa' }

  // 2. Auto-generate one entry per month
  const repo = getPersonalExpenseRepository()

  for (const { year, month } of monthsToGenerate(d.startMonth, d.installmentCount ?? null)) {
    const mm = String(month).padStart(2, '0')
    const occurredAt = new Date(`${year}-${mm}-01T12:00:00`)
    const expense = PersonalExpense.create({
      id: toPersonalExpenseId(crypto.randomUUID()),
      ownerId: toUserId(user.id),
      categoryId: toCategoryId(d.categoryId),
      occurredAt,
      amount: Money.of(d.amountCents),
      description: d.description,
      sourceId: 'recurring',
      externalId: `${template.id}-${year}-${mm}`,
    })
    await repo.save(expense)

    await supabase
      .from('personal_expenses')
      .update({ recurring_personal_expense_id: template.id })
      .eq('owner_id', user.id)
      .eq('source_id', 'recurring')
      .eq('external_id', `${template.id}-${year}-${mm}`)
  }

  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function updateRecurringPersonalExpenseTemplate(input: unknown): Promise<ActionResult> {
  const schema = z.object({
    id: z.string().min(1),
    categoryId: z.string().min(1),
    amountCents: z.number().int().positive(),
    description: z.string().min(1),
  })

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  const fromDate = `${new Date().toISOString().slice(0, 7)}-01`

  await supabase.from('recurring_personal_expenses').update({
    category_id: d.categoryId,
    amount_cents: d.amountCents,
    description: d.description,
  }).eq('id', d.id)

  await supabase.from('personal_expenses').update({
    category_id: d.categoryId,
    amount_cents: d.amountCents,
    description: d.description,
  }).eq('recurring_personal_expense_id', d.id).gte('occurred_at', fromDate)

  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function updateRecurringPersonalExpenseSingleMonth(input: unknown): Promise<ActionResult> {
  const schema = z.object({
    templateId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    categoryId: z.string().min(1),
    amountCents: z.number().int().positive(),
    description: z.string().min(1),
  })

  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data

  const { error } = await supabase
    .from('personal_expenses')
    .update({
      category_id: d.categoryId,
      amount_cents: d.amountCents,
      description: d.description,
      recurring_personal_expense_id: null,
    })
    .eq('recurring_personal_expense_id', d.templateId)
    .eq('occurred_at', `${d.month}-01`)

  if (error) return { success: false, error: 'Erro ao atualizar a despesa' }

  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function deactivateRecurringPersonalTemplate(
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
    .from('personal_expenses')
    .delete()
    .eq('recurring_personal_expense_id', templateId)
    .gte('occurred_at', fromDate)

  await supabase
    .from('recurring_personal_expenses')
    .update({ active: false })
    .eq('id', templateId)

  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function deletePersonalExpenseFuture(
  recurringPersonalExpenseId: string,
  fromOccurredAt: string, // "YYYY-MM-DD"
): Promise<ActionResult> {
  if (!recurringPersonalExpenseId || !fromOccurredAt) {
    return { success: false, error: 'Dados inválidos' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  await supabase
    .from('personal_expenses')
    .delete()
    .eq('recurring_personal_expense_id', recurringPersonalExpenseId)
    .gte('occurred_at', fromOccurredAt)

  const { count } = await supabase
    .from('personal_expenses')
    .select('*', { count: 'exact', head: true })
    .eq('recurring_personal_expense_id', recurringPersonalExpenseId)

  if ((count ?? 0) === 0) {
    await supabase
      .from('recurring_personal_expenses')
      .update({ active: false })
      .eq('id', recurringPersonalExpenseId)
  }

  revalidatePath('/dashboard/individual')
  return { success: true }
}

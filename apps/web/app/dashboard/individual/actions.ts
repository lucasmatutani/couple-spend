'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getIncomeRepository, getInvestmentRepository, getPersonalExpenseRepository } from '@/lib/container'
import {
  Income,
  Investment,
  Money,
  PersonalExpense,
  toCategoryId,
  toIncomeId,
  toInvestmentId,
  toPersonalExpenseId,
  toUserId,
} from '@splitwise/domain'

type ActionResult = { success: true } | { success: false; error: string }

function monthsUntilYearEnd(): { year: number; month: number }[] {
  const now = new Date()
  const currentYear = now.getFullYear()
  const result = []
  for (let m = now.getMonth(); m <= 11; m++) {
    result.push({ year: currentYear, month: m + 1 })
  }
  return result
}

// ---------------------------------------------------------------------------
// Income
// ---------------------------------------------------------------------------

const incomeSchema = z.object({
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  source: z.string().min(1).max(120),
  recurring: z.boolean(),
})

export async function addIncome(input: unknown): Promise<ActionResult> {
  const parsed = incomeSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data

  if (d.recurring) {
    // Create template and auto-generate entries for each month until Dec of current year
    const { data: template, error: tmplErr } = await supabase
      .from('recurring_incomes')
      .insert({ owner_id: user.id, source: d.source, amount_cents: d.amountCents })
      .select('id')
      .single()

    if (tmplErr || !template) return { success: false, error: 'Erro ao criar receita recorrente' }

    for (const { year, month } of monthsUntilYearEnd()) {
      const mm = String(month).padStart(2, '0')
      await supabase.from('incomes').insert({
        id: crypto.randomUUID(),
        owner_id: user.id,
        occurred_at: `${year}-${mm}-01`,
        amount_cents: d.amountCents,
        source: d.source,
        recurring: true,
        recurring_income_id: template.id,
      })
    }
  } else {
    const income = Income.create({
      id: toIncomeId(crypto.randomUUID()),
      ownerId: toUserId(user.id),
      occurredAt: new Date(d.occurredAt),
      amount: Money.of(d.amountCents),
      source: d.source,
      recurring: false,
    })
    await getIncomeRepository().save(income)
  }

  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function deleteIncome(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID inválido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  await getIncomeRepository().delete(toIncomeId(id))
  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function updateIncomeSingle(input: unknown): Promise<ActionResult> {
  const schema = z.object({
    id: z.string().min(1),
    source: z.string().min(1).max(120),
    amountCents: z.number().int().positive(),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const { error } = await supabase
    .from('incomes')
    .update({ source: parsed.data.source, amount_cents: parsed.data.amountCents })
    .eq('id', parsed.data.id)
  if (error) return { success: false, error: 'Erro ao atualizar receita' }

  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function updateIncomeFuture(input: unknown): Promise<ActionResult> {
  const schema = z.object({
    recurringIncomeId: z.string().min(1),
    fromOccurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    source: z.string().min(1).max(120),
    amountCents: z.number().int().positive(),
  })
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  await supabase
    .from('incomes')
    .update({ source: d.source, amount_cents: d.amountCents })
    .eq('recurring_income_id', d.recurringIncomeId)
    .gte('occurred_at', d.fromOccurredAt)

  await supabase
    .from('recurring_incomes')
    .update({ source: d.source, amount_cents: d.amountCents })
    .eq('id', d.recurringIncomeId)

  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function deleteIncomeFuture(
  recurringIncomeId: string,
  fromOccurredAt: string, // "YYYY-MM-DD"
): Promise<ActionResult> {
  if (!recurringIncomeId || !fromOccurredAt) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  await supabase
    .from('incomes')
    .delete()
    .eq('recurring_income_id', recurringIncomeId)
    .gte('occurred_at', fromOccurredAt)

  const { count } = await supabase
    .from('incomes')
    .select('*', { count: 'exact', head: true })
    .eq('recurring_income_id', recurringIncomeId)

  if ((count ?? 0) === 0) {
    await supabase
      .from('recurring_incomes')
      .update({ active: false })
      .eq('id', recurringIncomeId)
  }

  revalidatePath('/dashboard/individual')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Personal expense
// ---------------------------------------------------------------------------

const personalExpenseSchema = z.object({
  categoryId: z.string().min(1),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  description: z.string().nullable(),
})

export async function addPersonalExpense(input: unknown): Promise<ActionResult> {
  const parsed = personalExpenseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  const expense = PersonalExpense.create({
    id: toPersonalExpenseId(crypto.randomUUID()),
    ownerId: toUserId(user.id),
    categoryId: toCategoryId(d.categoryId),
    occurredAt: new Date(d.occurredAt),
    amount: Money.of(d.amountCents),
    description: d.description,
    sourceId: 'manual',
    externalId: crypto.randomUUID(),
  })

  await getPersonalExpenseRepository().save(expense)
  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function deletePersonalExpense(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID inválido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  await getPersonalExpenseRepository().delete(toPersonalExpenseId(id))
  revalidatePath('/dashboard/individual')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Investment
// ---------------------------------------------------------------------------

const investmentSchema = z.object({
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  assetClass: z.enum(['stocks', 'fixed_income', 'real_estate', 'crypto', 'other']),
  description: z.string().nullable(),
})

export async function addInvestment(input: unknown): Promise<ActionResult> {
  const parsed = investmentSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  const investment = Investment.create({
    id: toInvestmentId(crypto.randomUUID()),
    ownerId: toUserId(user.id),
    occurredAt: new Date(d.occurredAt),
    amount: Money.of(d.amountCents),
    assetClass: d.assetClass,
    description: d.description,
  })

  await getInvestmentRepository().save(investment)
  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function deleteInvestment(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID inválido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  await getInvestmentRepository().delete(toInvestmentId(id))
  revalidatePath('/dashboard/individual')
  return { success: true }
}

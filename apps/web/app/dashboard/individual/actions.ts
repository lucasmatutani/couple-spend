'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getIncomeRepository, getInvestmentRepository, getPersonalExpenseRepository } from '@/lib/container'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { upsertCreditCardHouseholdSplit, removeCreditCardHouseholdSplit } from '@/lib/cc-split'
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
  type PaymentMethod,
} from '@splitwise/domain'

type ActionResult = { success: true } | { success: false; error: string }

function monthsFromDateToYearEnd(startDate: string): { year: number; month: number }[] {
  const [y, m] = startDate.split('-').map(Number) as [number, number]
  const result = []
  for (let month = m; month <= 12; month++) {
    result.push({ year: y, month })
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

    for (const { year, month } of monthsFromDateToYearEnd(d.occurredAt)) {
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

const PAYMENT_METHODS = ['credit_card', 'debit', 'pix', 'cash', 'other'] as const

const personalExpenseSchema = z.object({
  categoryId: z.string().min(1),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  description: z.string().nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
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
    paymentMethod: d.paymentMethod as PaymentMethod | null,
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

// ---------------------------------------------------------------------------
// Credit-card — delete all CC expenses for a given month
// ---------------------------------------------------------------------------

export async function deleteCreditCardMonth(monthParam: string): Promise<ActionResult> {
  if (!/^\d{4}-\d{2}$/.test(monthParam)) return { success: false, error: 'Mês inválido' }

  const [y, m] = monthParam.split('-') as [string, string]
  const start = `${y}-${m.padStart(2, '0')}-01`
  const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate()
  const end = `${y}-${m.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const { data: toDelete } = await supabase
    .from('personal_expenses')
    .select('id')
    .eq('payment_method', 'credit_card')
    .gte('occurred_at', start)
    .lte('occurred_at', end)

  const ids = (toDelete ?? []).map((r) => r.id)

  if (ids.length > 0) {
    const householdRepo = new SupabaseHouseholdRepository()
    const household = await householdRepo.findFirstByMember(toUserId(user.id))
    if (household) {
      await supabase
        .from('expenses')
        .delete()
        .eq('household_id', household.id)
        .eq('source_id', 'cc-split')
        .in('external_id', ids)
    }

    await supabase
      .from('personal_expenses')
      .delete()
      .eq('payment_method', 'credit_card')
      .gte('occurred_at', start)
      .lte('occurred_at', end)
  }

  revalidatePath('/dashboard/individual')
  revalidatePath('/dashboard/household')
  return { success: true }
}

// ---------------------------------------------------------------------------
// Credit-card expense — edit category / amount / split
// ---------------------------------------------------------------------------

const updateCCExpenseSchema = z.object({
  id: z.string().min(1),
  categoryId: z.string().min(1),
  amountCents: z.number().int().positive(),
  splitParts: z.number().int().min(1).max(10),
  reimbursed: z.boolean().default(false),
  splitWithPartner: z.boolean().default(false),
  description: z.string().nullable().optional(),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export async function updateCreditCardExpense(input: unknown): Promise<ActionResult> {
  const parsed = updateCCExpenseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const { id, categoryId, amountCents, splitParts, reimbursed, splitWithPartner, description, occurredAt } = parsed.data

  const { error: updateErr } = await supabase
    .from('personal_expenses')
    .update({ category_id: categoryId, amount_cents: amountCents, split_parts: splitParts, reimbursed, split_with_partner: splitWithPartner } as never)
    .eq('id', id)
    .eq('owner_id', user.id)
  if (updateErr) return { success: false, error: 'Erro ao atualizar despesa' }

  // Sync the household share —————————————————————————————————————————————
  const needsHouseholdSplit = splitWithPartner && !reimbursed

  const householdRepo = new SupabaseHouseholdRepository()
  const household = await householdRepo.findFirstByMember(toUserId(user.id))

  if (needsHouseholdSplit) {
    if (!household) return { success: false, error: 'Household não encontrado' }
    await upsertCreditCardHouseholdSplit(supabase, {
      personalExpenseId: id,
      householdId: household.id as string,
      paidBy: user.id,
      categoryId,
      occurredAt,
      amountCents,
      description: description ?? null,
    })
  } else if (household) {
    // split_parts reverted to 1, or expense is reimbursed — remove any linked household expense
    await removeCreditCardHouseholdSplit(supabase, household.id as string, id)
  }

  revalidatePath('/dashboard/individual')
  revalidatePath('/dashboard/household')
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

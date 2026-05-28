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
  const income = Income.create({
    id: toIncomeId(crypto.randomUUID()),
    ownerId: toUserId(user.id),
    occurredAt: new Date(d.occurredAt),
    amount: Money.of(d.amountCents),
    source: d.source,
    recurring: d.recurring,
  })

  await getIncomeRepository().save(income)
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

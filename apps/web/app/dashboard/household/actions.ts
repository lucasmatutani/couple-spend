'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { SupabaseExpenseRepository } from '@/lib/repositories/SupabaseExpenseRepository'
import {
  Expense,
  Money,
  SplitRule,
  toCategoryId,
  toExpenseId,
  toHouseholdId,
  toUserId,
} from '@splitwise/domain'

type ActionResult = { success: true } | { success: false; error: string }

const expenseSchema = z.object({
  householdId: z.string().min(1),
  categoryId: z.string().min(1),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountCents: z.number().int().positive(),
  description: z.string().nullable(),
  splitRuleType: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
  splitRulePayerPercent: z.number().min(0).max(100).nullable(),
})

function buildSplitRule(
  type: z.infer<typeof expenseSchema>['splitRuleType'],
  payerPercent: number | null,
): SplitRule {
  switch (type) {
    case 'EQUAL':
      return SplitRule.equal()
    case 'ONLY_PAYER':
      return SplitRule.onlyPayer()
    case 'ONLY_OTHER':
      return SplitRule.onlyOther()
    case 'CUSTOM':
      return SplitRule.custom(payerPercent!)
  }
}

export async function addExpense(input: unknown): Promise<ActionResult> {
  const parsed = expenseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  const expense = Expense.create({
    id: toExpenseId(crypto.randomUUID()),
    householdId: toHouseholdId(d.householdId),
    paidBy: toUserId(user.id), // RLS enforces paid_by = auth.uid()
    categoryId: toCategoryId(d.categoryId),
    occurredAt: new Date(d.occurredAt),
    amount: Money.of(d.amountCents),
    description: d.description,
    splitRule: buildSplitRule(d.splitRuleType, d.splitRulePayerPercent),
    sourceId: 'manual',
    externalId: crypto.randomUUID(),
  })

  await new SupabaseExpenseRepository().save(expense)
  revalidatePath('/dashboard/household')
  return { success: true }
}

const updateExpenseSchema = expenseSchema.extend({ id: z.string().min(1) })

export async function updateExpense(input: unknown): Promise<ActionResult> {
  const parsed = updateExpenseSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Dados inválidos' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  const d = parsed.data
  const expense = Expense.create({
    id: toExpenseId(d.id),
    householdId: toHouseholdId(d.householdId),
    paidBy: toUserId(user.id), // RLS enforces paid_by = auth.uid()
    categoryId: toCategoryId(d.categoryId),
    occurredAt: new Date(d.occurredAt),
    amount: Money.of(d.amountCents),
    description: d.description,
    splitRule: buildSplitRule(d.splitRuleType, d.splitRulePayerPercent),
    sourceId: 'manual',
    externalId: d.id,
  })

  await new SupabaseExpenseRepository().save(expense)
  revalidatePath('/dashboard/household')
  return { success: true }
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID inválido' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Não autorizado' }

  await new SupabaseExpenseRepository().delete(toExpenseId(id))
  revalidatePath('/dashboard/household')
  return { success: true }
}

export async function markSettled(
  _from: string,
  _to: string,
  _amountCents: number,
  _month: string,
): Promise<ActionResult> {
  // Placeholder — settlements table is planned for Phase 2.
  revalidatePath('/dashboard/household')
  return { success: true }
}

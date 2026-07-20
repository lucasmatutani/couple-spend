'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getGoalRepository } from '@/lib/container'
import { Goal, toGoalId, toUserId, YearMonth, InvalidGoalError } from '@splitwise/domain'
import { randomUUID } from 'node:crypto'

type ActionResult = { success: true } | { success: false; error: string }

const addGoalSchema = z.object({
  goalType: z.enum(['MIN_SAVINGS', 'MIN_SURPLUS']),
  targetPercent: z.coerce.number().int().min(0).max(100),
  appliesToMonth: z.string().optional(),
})

export async function addGoal(input: unknown): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const parsed = addGoalSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' }

  const { goalType, targetPercent, appliesToMonth } = parsed.data

  let month: YearMonth | null = null
  if (appliesToMonth) {
    try {
      month = YearMonth.fromString(appliesToMonth)
    } catch {
      return { success: false, error: 'Invalid month format' }
    }
  }

  try {
    const goal = Goal.create({
      id: toGoalId(randomUUID()),
      ownerId: toUserId(user.id),
      goalType,
      targetPercent,
      appliesToMonth: month,
    })
    await getGoalRepository().save(goal)
  } catch (err) {
    if (err instanceof InvalidGoalError) return { success: false, error: err.message }
    throw err
  }

  revalidatePath('/dashboard/settings/goals')
  revalidatePath('/dashboard/individual')
  return { success: true }
}

// Accepts FormData second arg so callers can use .bind(null, id) as a form action.
export async function deleteGoal(id: string, _formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await getGoalRepository().delete(toGoalId(id))

  revalidatePath('/dashboard/settings/goals')
  revalidatePath('/dashboard/individual')
}

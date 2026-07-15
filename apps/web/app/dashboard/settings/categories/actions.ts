'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { toHouseholdId, toUserId } from '@splitwise/domain'

type ActionResult = { success: true } | { success: false; error: string }

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(60),
  budgetBucket: z.enum(['needs', 'wants', 'savings']),
  defaultSplitRule: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
})

export async function createCategory(input: unknown): Promise<ActionResult> {
  const parsed = createCategorySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const household = await new SupabaseHouseholdRepository().findFirstByMember(toUserId(user.id))
  if (!household) return { success: false, error: 'Lar não encontrado' }

  try {
    await new SupabaseCategoryRepository().create({
      householdId: toHouseholdId(household.id as string),
      name: parsed.data.name,
      budgetBucket: parsed.data.budgetBucket,
      defaultSplitRule: parsed.data.defaultSplitRule,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    if (message.includes('row-level security')) {
      return { success: false, error: 'Apenas o dono do lar pode criar categorias' }
    }
    return { success: false, error: 'Erro ao criar categoria' }
  }

  revalidatePath('/dashboard/settings/categories')
  revalidatePath('/dashboard/household')
  revalidatePath('/dashboard/individual')
  return { success: true }
}

'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { SupabaseCategoryRepository } from '@/lib/repositories/SupabaseCategoryRepository'
import { toCategoryId, toHouseholdId, toUserId, type Household } from '@splitwise/domain'

type ActionResult = { success: true } | { success: false; error: string }

const categoryFieldsSchema = {
  name: z.string().trim().min(1, 'Nome obrigatório').max(60),
  keywordsHint: z.string().trim().max(300).nullable().optional(),
}

const createCategorySchema = z.object(categoryFieldsSchema)
const updateCategorySchema = z.object({ id: z.string().min(1), ...categoryFieldsSchema })

async function requireOwnerHousehold(): Promise<
  { success: true; household: Household } | { success: false; error: string }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const userId = toUserId(user.id)
  const household = await new SupabaseHouseholdRepository().findFirstByMember(userId)
  if (!household) return { success: false, error: 'Lar não encontrado' }

  if (!household.isOwner(userId)) {
    return { success: false, error: 'Apenas o dono do lar pode gerenciar categorias' }
  }

  return { success: true, household }
}

export async function createCategory(input: unknown): Promise<ActionResult> {
  const parsed = createCategorySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const check = await requireOwnerHousehold()
  if (!check.success) return check

  try {
    await new SupabaseCategoryRepository().create({
      householdId: toHouseholdId(check.household.id as string),
      name: parsed.data.name,
      keywordsHint: parsed.data.keywordsHint || null,
    })
  } catch {
    return { success: false, error: 'Erro ao criar categoria' }
  }

  revalidatePath('/dashboard/settings/categories')
  revalidatePath('/dashboard/household')
  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function updateCategory(input: unknown): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' }

  const check = await requireOwnerHousehold()
  if (!check.success) return check

  const repo = new SupabaseCategoryRepository()
  const categoryId = toCategoryId(parsed.data.id)
  const existing = await repo.findById(categoryId)
  if (!existing || (existing.householdId as string | null) !== (check.household.id as string)) {
    return { success: false, error: 'Categoria não encontrada' }
  }

  try {
    await repo.update(categoryId, {
      name: parsed.data.name,
      keywordsHint: parsed.data.keywordsHint || null,
    })
  } catch {
    return { success: false, error: 'Erro ao atualizar categoria' }
  }

  revalidatePath('/dashboard/settings/categories')
  revalidatePath('/dashboard/household')
  revalidatePath('/dashboard/individual')
  return { success: true }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'ID inválido' }

  const check = await requireOwnerHousehold()
  if (!check.success) return check

  const repo = new SupabaseCategoryRepository()
  const categoryId = toCategoryId(id)
  const existing = await repo.findById(categoryId)
  if (!existing || (existing.householdId as string | null) !== (check.household.id as string)) {
    return { success: false, error: 'Categoria não encontrada' }
  }

  try {
    await repo.delete(categoryId)
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    if (message.includes('foreign key')) {
      return { success: false, error: 'Categoria em uso em despesas existentes — não é possível excluir' }
    }
    return { success: false, error: 'Erro ao excluir categoria' }
  }

  revalidatePath('/dashboard/settings/categories')
  revalidatePath('/dashboard/household')
  revalidatePath('/dashboard/individual')
  return { success: true }
}

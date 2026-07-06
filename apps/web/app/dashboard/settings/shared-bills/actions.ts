'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

export type KeywordKind = 'split' | 'reimbursed'

type ActionResult = { success: true } | { success: false; error: string }

const addKeywordSchema = z.object({
  keyword: z.string().trim().min(1).max(60),
  kind: z.enum(['split', 'reimbursed']),
})

export async function addSharedBillKeyword(input: unknown): Promise<ActionResult> {
  const parsed = addKeywordSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Palavra-chave inválida' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('shared_bill_keywords')
    .insert({ owner_id: user.id, keyword: parsed.data.keyword, kind: parsed.data.kind })

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Essa palavra-chave já está cadastrada' }
    return { success: false, error: 'Erro ao salvar palavra-chave' }
  }

  revalidatePath('/dashboard/settings/shared-bills')
  return { success: true }
}

const updateKeywordSchema = z.object({
  id: z.string().min(1),
  keyword: z.string().trim().min(1).max(60),
})

export async function updateSharedBillKeyword(input: unknown): Promise<ActionResult> {
  const parsed = updateKeywordSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? 'Palavra-chave inválida' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('shared_bill_keywords')
    .update({ keyword: parsed.data.keyword })
    .eq('id', parsed.data.id)
    .eq('owner_id', user.id)

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Essa palavra-chave já está cadastrada' }
    return { success: false, error: 'Erro ao atualizar palavra-chave' }
  }

  revalidatePath('/dashboard/settings/shared-bills')
  return { success: true }
}

export async function deleteSharedBillKeyword(id: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('shared_bill_keywords').delete().eq('id', id)

  revalidatePath('/dashboard/settings/shared-bills')
}

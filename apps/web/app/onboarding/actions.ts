'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { generateInviteToken } from '@/lib/invite'

const schema = z.object({ name: z.string().min(1).max(80) })

export async function createHousehold(formData: FormData) {
  const parsed = schema.safeParse({ name: formData.get('name') })
  if (!parsed.success) throw new Error('Invalid household name')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // INSERT without RETURNING to avoid PostgREST applying households_select RLS
  // (is_household_member) before the trigger has committed the owner row.
  const { error: insertError } = await supabase
    .from('households')
    .insert({ name: parsed.data.name, created_by: user.id })

  if (insertError) throw new Error(`Failed to create household: ${insertError.message}`)

  // Now the trigger has run — the user is in household_members as owner.
  // SELECT is now safe because is_household_member returns true.
  const { data: household, error: selectError } = await supabase
    .from('households')
    .select('id')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (selectError || !household) throw new Error(`Failed to retrieve created household: ${selectError?.message ?? 'no data'}`)

  const token = await generateInviteToken(household.id)
  redirect(`/onboarding?step=2&token=${encodeURIComponent(token)}`)
}

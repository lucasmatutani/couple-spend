'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createConnectToken, deletePluggyItem } from '@splitwise/import-open-finance'
import { getOpenFinanceSource } from '@/lib/import-sources'
import { getImportUseCase, getImportRepository } from '@/lib/container'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { toUserId } from '@splitwise/domain'

export async function initiateConnection(): Promise<{ accessToken: string }> {
  const clientId = process.env.PLUGGY_CLIENT_ID!
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET!
  return createConnectToken(clientId, clientSecret)
}

export async function saveConnection(
  itemId: string,
  institutionName: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { error } = await supabase.from('connected_accounts').insert({
    owner_id: user.id,
    provider: 'pluggy',
    provider_item_id: itemId,
    institution_name: institutionName,
    status: 'active',
  })

  if (error) return { success: false, error: error.message }

  // Trigger initial sync in background — failures are non-fatal
  void syncByItemId(user.id, itemId, institutionName)

  revalidatePath('/dashboard/settings/connections')
  return { success: true }
}

export async function disconnectAccount(
  accountId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: account } = await supabase
    .from('connected_accounts')
    .select('provider_item_id')
    .eq('id', accountId)
    .single()

  if (account) {
    try {
      const clientId = process.env.PLUGGY_CLIENT_ID!
      const clientSecret = process.env.PLUGGY_CLIENT_SECRET!
      await deletePluggyItem(clientId, clientSecret, account.provider_item_id)
    } catch {
      // Pluggy item may already be deleted; proceed with local soft-delete
    }
  }

  await supabase
    .from('connected_accounts')
    .update({ status: 'disconnected' })
    .eq('id', accountId)

  revalidatePath('/dashboard/settings/connections')
  return { success: true }
}

async function syncByItemId(
  userId: string,
  itemId: string,
  institutionName: string,
): Promise<void> {
  try {
    const household = await new SupabaseHouseholdRepository().findFirstByMember(toUserId(userId))
    if (!household) return

    const source = getOpenFinanceSource(itemId, institutionName)
    const useCase = getImportUseCase()

    const to = new Date()
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)
    await useCase.execute(source, { dateRange: { from, to } }, userId, household.id as string)
  } catch {
    // Sync errors are non-fatal; cron will retry
  }
}

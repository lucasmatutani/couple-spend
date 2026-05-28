import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOpenFinanceSource } from '@/lib/import-sources'
import { getImportUseCase } from '@/lib/container'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { toUserId } from '@splitwise/domain'
import { TransactionSourceUnavailableError } from '@splitwise/import-core'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization') ?? ''
  const cronSecret = process.env.CRON_SECRET ?? ''

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: accounts } = await admin
    .from('connected_accounts')
    .select('id, owner_id, provider_item_id, institution_name')
    .eq('status', 'active')

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ synced: 0, errors: 0, errorDetails: [] })
  }

  // Group by owner to reuse household lookups
  const byOwner = new Map<string, typeof accounts>()
  for (const account of accounts) {
    const list = byOwner.get(account.owner_id) ?? []
    list.push(account)
    byOwner.set(account.owner_id, list)
  }

  const householdRepo = new SupabaseHouseholdRepository()
  const useCase = getImportUseCase()

  const to = new Date()
  const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000)

  let synced = 0
  let errors = 0
  const errorDetails: string[] = []

  for (const [ownerId, ownerAccounts] of byOwner) {
    let householdId: string | null = null
    try {
      const household = await householdRepo.findFirstByMember(toUserId(ownerId))
      householdId = household ? (household.id as string) : null
    } catch {
      // Skip owner if household lookup fails
    }
    if (!householdId) continue

    for (const account of ownerAccounts) {
      try {
        const source = getOpenFinanceSource(account.provider_item_id, account.institution_name)
        await useCase.execute(source, { dateRange: { from, to } }, ownerId, householdId)

        await admin
          .from('connected_accounts')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('id', account.id)

        synced++
      } catch (err) {
        errors++
        const message = err instanceof Error ? err.message : 'Unknown error'
        errorDetails.push(`account:${account.id} — ${message}`)

        if (err instanceof TransactionSourceUnavailableError) {
          await admin
            .from('connected_accounts')
            .update({ status: 'error' })
            .eq('id', account.id)
        }
      }
    }
  }

  return NextResponse.json({ synced, errors, errorDetails })
}

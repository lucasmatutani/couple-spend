import { YearMonth, canAddMember, canImportMonth, type HouseholdId, type UserId } from '@splitwise/domain'
import type { PlanTier } from '@splitwise/domain'
import { createClient } from './supabase/server'

export class PlanLimitError extends Error {
  constructor(public readonly reason: 'upgrade_members' | 'upgrade_history') {
    super(`Plan limit reached: ${reason}`)
    this.name = 'PlanLimitError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

async function getUserPlan(userId: UserId): Promise<PlanTier> {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select('plan').eq('id', userId).single()
  return (data?.plan ?? 'free') as PlanTier
}

export async function checkCanAddMember(
  householdId: HouseholdId,
  actingUserId: UserId,
): Promise<void> {
  const supabase = await createClient()

  const [{ count }, plan] = await Promise.all([
    supabase
      .from('household_members')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId)
      .then((r) => ({ count: r.count ?? 0 })),
    getUserPlan(actingUserId),
  ])

  if (!canAddMember(plan, count)) {
    throw new PlanLimitError('upgrade_members')
  }
}

export async function checkCanImportMonth(
  userId: UserId,
  requestedMonth: YearMonth,
): Promise<void> {
  const [plan, now] = await Promise.all([getUserPlan(userId), Promise.resolve(YearMonth.current())])

  const monthsAgo = (now.year - requestedMonth.year) * 12 + (now.month - requestedMonth.month)

  if (!canImportMonth(plan, monthsAgo)) {
    throw new PlanLimitError('upgrade_history')
  }
}

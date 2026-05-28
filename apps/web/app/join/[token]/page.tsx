import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { verifyInviteToken } from '@/lib/invite'
import { toHouseholdId, toUserId } from '@splitwise/domain'
import { checkCanAddMember, PlanLimitError } from '@/lib/plan-guard'

export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const verified = await verifyInviteToken(token)

  if (!verified) redirect('/login?error=invalid_invite')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect(`/login?next=/join/${encodeURIComponent(token)}`)

  const householdId = toHouseholdId(verified.householdId)
  const userId = toUserId(user.id)

  try {
    await checkCanAddMember(householdId, userId)
  } catch (err) {
    if (err instanceof PlanLimitError) {
      redirect('/dashboard/billing?error=plan_limit')
    }
    throw err
  }

  const repo = new SupabaseHouseholdRepository()
  await repo.addMember(householdId, userId)

  redirect('/dashboard')
}

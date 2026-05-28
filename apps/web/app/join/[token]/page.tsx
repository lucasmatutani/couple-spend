import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { verifyInviteToken } from '@/lib/invite'
import { toHouseholdId, toUserId } from '@splitwise/domain'

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

  const repo = new SupabaseHouseholdRepository()
  await repo.addMember(toHouseholdId(verified.householdId), toUserId(user.id))

  redirect('/dashboard')
}

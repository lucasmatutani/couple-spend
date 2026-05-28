'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
// createAdminClient is used here intentionally: creating a user requires the service_role
// key. This action runs only on the server and validates the calling user before proceeding.
import { createAdminClient } from '@/lib/supabase/admin'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { toHouseholdId, toUserId } from '@splitwise/domain'
import { checkCanAddMember, PlanLimitError } from '@/lib/plan-guard'
import { sendPartnerInviteEmail } from '@/lib/email'

const schema = z.object({
  email: z.string().email('E-mail inválido.'),
})

function generateTempPassword(): string {
  // No symbols — keeps the password typeable without layout switching
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export type AddPartnerState =
  | { status: 'idle' }
  | { status: 'success'; email: string }
  | { status: 'error'; error: string }

export async function addPartnerByEmail(
  _prev: AddPartnerState,
  formData: FormData,
): Promise<AddPartnerState> {
  const parsed = schema.safeParse({ email: formData.get('email') })
  if (!parsed.success) {
    return { status: 'error', error: parsed.error.issues[0]?.message ?? 'E-mail inválido.' }
  }

  const { email } = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'error', error: 'Não autenticado.' }

  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return { status: 'error', error: 'Você não pode adicionar a si mesmo.' }
  }

  const repo = new SupabaseHouseholdRepository()
  const household = await repo.findFirstByMember(toUserId(user.id))
  if (!household) return { status: 'error', error: 'Lar não encontrado.' }

  const householdId = toHouseholdId(household.id as string)

  try {
    await checkCanAddMember(householdId, toUserId(user.id))
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return { status: 'error', error: 'Limite de membros do plano atingido.' }
    }
    throw err
  }

  const admin = createAdminClient()

  // Look up partner in public.users (mirrored from auth.users, RLS bypassed by service_role)
  const { data: existingProfile } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existingProfile?.id) {
    const alreadyMember = household.members.some((m) => (m.userId as string) === existingProfile.id)
    if (alreadyMember) return { status: 'error', error: 'Este e-mail já faz parte do lar.' }

    await repo.addMember(householdId, toUserId(existingProfile.id))
    revalidatePath('/dashboard/settings')
    return { status: 'success', email }
  }

  // Partner doesn't have an account yet — create one with a temporary password
  const tempPassword = generateTempPassword()
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      display_name: email.split('@')[0],
      must_change_password: true,
    },
  })

  if (createError || !newUser.user) {
    return { status: 'error', error: 'Não foi possível criar a conta do parceiro.' }
  }

  await repo.addMember(householdId, toUserId(newUser.user.id))

  const inviterName =
    (user.user_metadata?.['display_name'] as string | undefined) ??
    user.email?.split('@')[0] ??
    'Seu parceiro'

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

  await sendPartnerInviteEmail({ to: email, inviterName, tempPassword, appUrl })

  revalidatePath('/dashboard/settings')
  return { status: 'success', email }
}

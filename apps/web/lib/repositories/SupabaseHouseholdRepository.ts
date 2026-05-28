import { createClient } from '@/lib/supabase/server'
import {
  Household,
  toHouseholdId,
  toUserId,
  type HouseholdId,
  type HouseholdRepository,
  type MemberRole,
  type UserId,
} from '@splitwise/domain'

type HouseholdRow = {
  id: string
  name: string
  created_by: string
  created_at: string
  household_members: { user_id: string; role: 'owner' | 'member'; joined_at: string }[]
}

function fromDb(row: HouseholdRow): Household {
  return Household.create({
    id: toHouseholdId(row.id),
    name: row.name,
    createdBy: toUserId(row.created_by),
    members: row.household_members.map((m) => ({
      userId: toUserId(m.user_id),
      role: m.role,
      joinedAt: new Date(m.joined_at),
    })),
    createdAt: new Date(row.created_at),
  })
}

export class SupabaseHouseholdRepository implements HouseholdRepository {
  // RLS enforces household membership — no explicit household_id security filter needed.

  async findById(id: HouseholdId): Promise<Household | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('households')
      .select('*, household_members(user_id, role, joined_at)')
      .eq('id', id)
      .maybeSingle()

    if (error ?? !data) return null
    return fromDb(data as unknown as HouseholdRow)
  }

  async findByMember(_userId: UserId): Promise<Household[]> {
    // RLS on households filters to only households the current user is a member of.
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('households')
      .select('*, household_members(user_id, role, joined_at)')

    if (error ?? !data) return []
    return (data as unknown as HouseholdRow[]).map(fromDb)
  }

  async findFirstByMember(userId: UserId): Promise<Household | null> {
    const all = await this.findByMember(userId)
    return all[0] ?? null
  }

  async create(name: string, createdBy: UserId): Promise<Household> {
    const supabase = await createClient()

    // INSERT without RETURNING: PostgreSQL 15+ raises an RLS error if the SELECT
    // policy (is_household_member) blocks the returned row, which happens when the
    // AFTER INSERT trigger has not yet propagated to the planner's snapshot.
    const { error: insertErr } = await supabase
      .from('households')
      .insert({ name, created_by: createdBy })

    if (insertErr) throw new Error(`Failed to create household: ${insertErr.message}`)

    // After the INSERT, the trigger has run and the creator is in household_members.
    // A separate SELECT is now safe because is_household_member returns true.
    const { data: household, error: selectErr } = await supabase
      .from('households')
      .select('*, household_members(user_id, role, joined_at)')
      .eq('created_by', createdBy)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (selectErr ?? !household) throw new Error(`Failed to retrieve created household: ${selectErr?.message ?? 'no data'}`)

    return fromDb(household as unknown as HouseholdRow)
  }

  async addMember(
    householdId: HouseholdId,
    userId: UserId,
    role: MemberRole = 'member',
  ): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase
      .from('household_members')
      .upsert(
        { household_id: householdId, user_id: userId, role },
        { onConflict: 'household_id,user_id' },
      )

    if (error) throw new Error(`Failed to add member: ${error.message}`)
  }
}

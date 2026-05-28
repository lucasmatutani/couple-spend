import { createClient } from '@/lib/supabase/server'
import { Goal, YearMonth, toGoalId, toUserId, type GoalId, type GoalRepository, type UserId } from '@splitwise/domain'

export class SupabaseGoalRepository implements GoalRepository {
  async findByOwner(ownerId: UserId): Promise<Goal[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })

    if (error) throw new Error(`Failed to fetch goals: ${error.message}`)
    return (data ?? []).map((row) =>
      Goal.create({
        id: toGoalId(row.id),
        ownerId: toUserId(row.owner_id),
        goalType: row.goal_type,
        targetPercent: row.target_percent,
        appliesToMonth: row.applies_to_month
          ? YearMonth.fromString(row.applies_to_month.substring(0, 7))
          : null,
        createdAt: new Date(row.created_at),
      }),
    )
  }

  async save(goal: Goal): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('goals').upsert({
      id: goal.id,
      owner_id: goal.ownerId,
      goal_type: goal.goalType,
      target_percent: goal.targetPercent,
      applies_to_month: goal.appliesToMonth ? `${goal.appliesToMonth.toString()}-01` : null,
      created_at: goal.createdAt.toISOString(),
    })
    if (error) throw new Error(`Failed to save goal: ${error.message}`)
  }

  async delete(id: GoalId): Promise<void> {
    const supabase = await createClient()
    const { error } = await supabase.from('goals').delete().eq('id', id)
    if (error) throw new Error(`Failed to delete goal: ${error.message}`)
  }
}

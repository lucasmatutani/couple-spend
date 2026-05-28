import { createClient } from '@/lib/supabase/server'
import { toUserId, type UserId, type UserProfile, type UserRepository } from '@splitwise/domain'

export class SupabaseUserRepository implements UserRepository {
  // RLS on users allows reading profiles of members in shared households.

  async findById(id: UserId): Promise<UserProfile | null> {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('id', id)
      .maybeSingle()

    if (error ?? !data) return null
    return { id: toUserId(data.id), displayName: data.display_name }
  }

  async findManyById(ids: UserId[]): Promise<UserProfile[]> {
    if (ids.length === 0) return []
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('users')
      .select('id, display_name')
      .in('id', ids)

    if (error ?? !data) return []
    return data.map((row) => ({ id: toUserId(row.id), displayName: row.display_name }))
  }
}

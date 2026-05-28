import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json([], { status: 401 })

  const { data } = await supabase
    .from('connected_accounts')
    .select('id, institution_name, status, last_synced_at, connected_at')
    .eq('owner_id', user.id)
    .neq('status', 'disconnected')
    .order('connected_at', { ascending: false })

  return NextResponse.json(data ?? [])
}

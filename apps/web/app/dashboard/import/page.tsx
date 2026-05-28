import { createClient } from '@/lib/supabase/server'
import ImportWizard from './components/ImportWizard'

export type ConnectedAccountSummary = {
  id: string
  institution_name: string
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let connectedAccounts: ConnectedAccountSummary[] = []
  if (user) {
    const { data } = await supabase
      .from('connected_accounts')
      .select('id, institution_name')
      .eq('owner_id', user.id)
      .eq('status', 'active')
    connectedAccounts = data ?? []
  }

  return <ImportWizard searchParamsPromise={searchParams} connectedAccounts={connectedAccounts} />
}

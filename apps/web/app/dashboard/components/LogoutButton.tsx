'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-muted-foreground">
      <LogOut className="h-4 w-4" />
      Sair
    </Button>
  )
}

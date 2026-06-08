import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { toUserId } from '@splitwise/domain'
import LogoutButton from './components/LogoutButton'
import MonthNavigator from './components/MonthNavigator'
import NavLinks from './components/NavLinks'
import { ThemeToggle } from '@/components/ui/theme-toggle'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const repo = new SupabaseHouseholdRepository()
  const household = await repo.findFirstByMember(toUserId(user.id))
  if (!household) redirect('/onboarding')

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col border-r bg-card px-4 py-6">
        <p className="mb-8 truncate text-lg font-semibold">{household.name}</p>
        <nav className="flex-1 space-y-1">
          <NavLinks variant="sidebar" />
        </nav>
        <LogoutButton />
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-col md:ml-64">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3">
          <span className="truncate text-sm font-medium md:hidden">{household.name}</span>
          <MonthNavigator />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <div className="hidden md:block">
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t bg-card md:hidden">
        <NavLinks variant="mobile" />
      </nav>
    </div>
  )
}

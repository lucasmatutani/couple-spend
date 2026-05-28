import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Home, Settings, Upload, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SupabaseHouseholdRepository } from '@/lib/repositories/SupabaseHouseholdRepository'
import { toUserId } from '@splitwise/domain'
import LogoutButton from './components/LogoutButton'
import MonthNavigator from './components/MonthNavigator'

const NAV_ITEMS = [
  { href: '/dashboard/household', label: 'Casa', Icon: Home },
  { href: '/dashboard/individual', label: 'Individual', Icon: User },
  { href: '/dashboard/import', label: 'Importar', Icon: Upload },
  { href: '/dashboard/settings', label: 'Config.', Icon: Settings },
]

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
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <LogoutButton />
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-col md:ml-64">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3">
          <span className="truncate text-sm font-medium md:hidden">{household.name}</span>
          <MonthNavigator />
          <div className="hidden md:block">
            <LogoutButton />
          </div>
        </header>

        <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t bg-card md:hidden">
        {NAV_ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}

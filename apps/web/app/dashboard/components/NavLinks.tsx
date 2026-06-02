'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Home, Settings, LayoutDashboard, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard/overview', label: 'Dashboard', Icon: LayoutDashboard, preserveMonth: true },
  { href: '/dashboard/household', label: 'Casa', Icon: Home, preserveMonth: true },
  { href: '/dashboard/individual', label: 'Individual', Icon: User, preserveMonth: true },
  { href: '/dashboard/settings', label: 'Config.', Icon: Settings, preserveMonth: false },
]

type Variant = 'sidebar' | 'mobile'

export default function NavLinks({ variant }: { variant: Variant }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const month = searchParams.get('month')

  function buildHref(item: (typeof NAV_ITEMS)[number]): string {
    if (item.preserveMonth && month) return `${item.href}?month=${month}`
    return item.href
  }

  if (variant === 'sidebar') {
    return (
      <>
        {NAV_ITEMS.map(({ href, label, Icon, preserveMonth }) => {
          const to = preserveMonth && month ? `${href}?month=${month}` : href
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={to}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${active ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </>
    )
  }

  return (
    <>
      {NAV_ITEMS.map(({ href, label, Icon, preserveMonth }) => {
        const to = preserveMonth && month ? `${href}?month=${month}` : href
        return (
          <Link
            key={href}
            href={to}
            className="flex flex-1 flex-col items-center gap-1 py-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        )
      })}
    </>
  )
}

'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function currentMonthString(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-') as [string, string]
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-') as [string, string]
  return `${MONTHS[parseInt(m, 10) - 1]!} ${y}`
}

export default function MonthNavigator({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const month = searchParams.get('month') ?? currentMonthString()

  // The overview page renders its own MonthNavigator further down the page
  // (below the consolidated insights), so the header instance stays hidden there.
  if (!alwaysShow && pathname.startsWith('/dashboard/overview')) return null

  function navigate(delta: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', shiftMonth(month, delta))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="w-36 text-center text-sm font-medium">{formatMonth(month)}</span>
      <Button variant="ghost" size="icon" onClick={() => navigate(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}

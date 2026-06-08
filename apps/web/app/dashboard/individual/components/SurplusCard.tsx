'use client'

import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import type { BudgetSummaryDto } from '../types'

type Props = { summary: BudgetSummaryDto }

export default function SurplusCard({ summary }: Props) {
  const { surplusFormatted, surplusCents, avgSurplus3mFormatted, avgSurplus3mCents } = summary

  const yearProjectionCents = Math.round(avgSurplus3mCents * 12)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Saldo do mês</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Money cents={surplusCents} size="lg" colorize className="block text-3xl" />
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Média 3 meses</span>
            <Money cents={avgSurplus3mCents} size="sm" colorize className="font-medium !text-foreground" />
          </div>
          <div className="flex justify-between">
            <span>Projeção anual</span>
            <Money cents={yearProjectionCents} size="sm" colorize className="font-medium !text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

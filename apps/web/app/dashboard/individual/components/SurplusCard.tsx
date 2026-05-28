'use client'

import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { BudgetSummaryDto } from '../types'

type Props = { summary: BudgetSummaryDto }

export default function SurplusCard({ summary }: Props) {
  const { surplusFormatted, surplusCents, avgSurplus3mFormatted, avgSurplus3mCents } = summary

  const yearProjection = Math.round(avgSurplus3mCents * 12)
  const yearFormatted = `R$ ${(yearProjection / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  const isPositive = surplusCents >= 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Saldo do mês</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className={`text-3xl font-bold ${isPositive ? 'text-green-600' : 'text-destructive'}`}>
          {surplusFormatted}
        </p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>Média 3 meses</span>
            <span className="font-medium text-foreground">{avgSurplus3mFormatted}</span>
          </div>
          <div className="flex justify-between">
            <span>Projeção anual</span>
            <span className="font-medium text-foreground">{yearFormatted}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client'

import { Card, CardContent } from '@/components/ui/card'
import type { BudgetSummaryDto } from '../types'

type Props = { summary: BudgetSummaryDto }

function pct(value: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((value / total) * 100))
}

export default function BudgetBreakdownBar({ summary }: Props) {
  const { totalIncomeCents, totalSpentCents, totalInvestedCents, surplusCents } = summary

  const spentPct = pct(totalSpentCents, totalIncomeCents)
  const investedPct = pct(totalInvestedCents, totalIncomeCents)
  const surplusPctRaw = pct(Math.max(0, surplusCents), totalIncomeCents)

  // Clamp so the three segments always sum to ≤ 100
  const total = spentPct + investedPct + surplusPctRaw
  const overflow = Math.max(0, total - 100)
  const surplusPct = Math.max(0, surplusPctRaw - overflow)

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="mb-3 flex items-end justify-between text-sm">
          <span className="text-muted-foreground">Renda</span>
          <span className="font-semibold">{summary.totalIncomeFormatted}</span>
        </div>

        {/* Stacked bar */}
        <div className="relative h-6 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute inset-y-0 left-0 bg-red-400 transition-all"
            style={{ width: `${spentPct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-blue-400 transition-all"
            style={{ left: `${spentPct}%`, width: `${investedPct}%` }}
          />
          <div
            className="absolute inset-y-0 bg-green-400 transition-all"
            style={{ left: `${spentPct + investedPct}%`, width: `${surplusPct}%` }}
          />
          {/* 50% dashed guideline */}
          <div className="absolute inset-y-0 left-1/2 w-px border-l-2 border-dashed border-white/60" />
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
            Gastos {spentPct}% — {summary.totalSpentFormatted}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
            Investimentos {investedPct}% — {summary.totalInvestedFormatted}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400" />
            Sobra {surplusPct}% — {summary.surplusFormatted}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

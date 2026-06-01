'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { deleteInvestment } from '../actions'
import AddInvestmentSheet from './AddInvestmentSheet'
import type { BudgetSummaryDto, InvestmentDto } from '../types'

const ASSET_CLASS_LABELS: Record<string, string> = {
  stocks: 'Ações',
  fixed_income: 'Renda Fixa',
  real_estate: 'FIIs',
  crypto: 'Cripto',
  other: 'Outros',
}

type Props = {
  investments: InvestmentDto[]
  summary: BudgetSummaryDto
  currentMonth: string
}

export default function InvestmentSummaryCard({ investments, summary, currentMonth }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    await deleteInvestment(id)
    setDeleting(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Investimentos</CardTitle>
        <AddInvestmentSheet
          currentMonth={currentMonth}
          trigger={
            <Button size="sm" variant="outline" className="gap-1 h-8">
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-bold text-blue-600">{summary.totalInvestedFormatted}</p>
        {investments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum investimento registrado neste mês.</p>
        ) : (
          <ul className="space-y-2">
            {investments.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {ASSET_CLASS_LABELS[inv.assetClass] ?? inv.assetClass}
                  </Badge>
                  {inv.description && (
                    <span className="truncate text-muted-foreground">{inv.description}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="font-medium text-blue-600">{inv.amountFormatted}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    disabled={deleting === inv.id}
                    onClick={() => handleDelete(inv.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

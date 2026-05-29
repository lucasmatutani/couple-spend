'use client'

import { useState } from 'react'
import { Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import RecurringScopeDialog from '@/components/RecurringScopeDialog'
import { deleteIncome, deleteIncomeFuture } from '../actions'
import AddIncomeSheet from './AddIncomeSheet'
import type { IncomeDto } from '../types'

type Props = {
  incomes: IncomeDto[]
  totalIncomeCents: number
}

export default function IncomeSummaryCard({ incomes, totalIncomeCents }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)
  const [scopeTarget, setScopeTarget] = useState<IncomeDto | null>(null)

  async function handleDelete(income: IncomeDto) {
    if (income.recurringIncomeId) {
      setScopeTarget(income)
      return
    }
    setDeleting(income.id)
    await deleteIncome(income.id)
    setDeleting(null)
  }

  async function handleDeleteSingle(income: IncomeDto) {
    setScopeTarget(null)
    setDeleting(income.id)
    await deleteIncome(income.id)
    setDeleting(null)
  }

  async function handleDeleteFuture(income: IncomeDto) {
    setScopeTarget(null)
    if (!income.recurringIncomeId) return
    setDeleting(income.id)
    await deleteIncomeFuture(income.recurringIncomeId, income.occurredAt)
    setDeleting(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Receitas</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-green-600">
            {`R$ ${(totalIncomeCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </span>
          <AddIncomeSheet trigger={
            <Button size="sm" variant="outline" className="gap-1 h-8">
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          } />
        </div>
      </CardHeader>
      <CardContent>
        {incomes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma receita registrada neste mês.</p>
        ) : (
          <ul className="space-y-2">
            {incomes.map((income) => (
              <li key={income.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{income.source}</span>
                  {income.recurringIncomeId && (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-xs">
                      <RefreshCw className="h-2.5 w-2.5" />
                      Recorrente
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="font-medium text-green-600">{income.amountFormatted}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    disabled={deleting === income.id}
                    onClick={() => handleDelete(income)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {scopeTarget && (
        <RecurringScopeDialog
          mode="delete"
          open={!!scopeTarget}
          onCancel={() => setScopeTarget(null)}
          onSingle={() => handleDeleteSingle(scopeTarget)}
          onFuture={() => handleDeleteFuture(scopeTarget)}
        />
      )}
    </Card>
  )
}

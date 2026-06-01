'use client'

import { useState } from 'react'
import { Pencil, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import RecurringScopeDialog from '@/components/RecurringScopeDialog'
import { deleteIncome, deleteIncomeFuture } from '../actions'
import AddIncomeSheet from './AddIncomeSheet'
import EditIncomeSheet from './EditIncomeSheet'
import type { IncomeDto } from '../types'

type Props = {
  incomes: IncomeDto[]
  totalIncomeCents: number
  currentMonth: string
}

export default function IncomeSummaryCard({ incomes, totalIncomeCents, currentMonth }: Props) {
  const [deleting, setDeleting] = useState<string | null>(null)

  // Edit flow
  const [editTarget, setEditTarget] = useState<IncomeDto | null>(null)
  const [editScope, setEditScope] = useState<'single' | 'future' | null>(null)

  // Scope dialog (shared for edit and delete)
  const [scopeDialog, setScopeDialog] = useState<{ mode: 'edit' | 'delete'; income: IncomeDto } | null>(null)

  // ── Delete ────────────────────────────────────────────────────────────────

  async function onClickDelete(income: IncomeDto) {
    if (income.recurringIncomeId) {
      setScopeDialog({ mode: 'delete', income })
    } else {
      setDeleting(income.id)
      await deleteIncome(income.id)
      setDeleting(null)
    }
  }

  async function handleDeleteSingle(income: IncomeDto) {
    setScopeDialog(null)
    setDeleting(income.id)
    await deleteIncome(income.id)
    setDeleting(null)
  }

  async function handleDeleteFuture(income: IncomeDto) {
    setScopeDialog(null)
    if (!income.recurringIncomeId) return
    setDeleting(income.id)
    await deleteIncomeFuture(income.recurringIncomeId, income.occurredAt)
    setDeleting(null)
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function onClickEdit(income: IncomeDto) {
    if (income.recurringIncomeId) {
      setScopeDialog({ mode: 'edit', income })
    } else {
      setEditTarget(income)
      setEditScope(null)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Receitas</CardTitle>
        <AddIncomeSheet
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
        <p className="text-3xl font-bold text-green-600">
          {`R$ ${(totalIncomeCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
        </p>
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
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <span className="font-medium text-green-600 mr-1">{income.amountFormatted}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => onClickEdit(income)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    disabled={deleting === income.id}
                    onClick={() => onClickDelete(income)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Scope dialog for recurring incomes */}
      {scopeDialog && (
        <RecurringScopeDialog
          mode={scopeDialog.mode}
          open={!!scopeDialog}
          onCancel={() => setScopeDialog(null)}
          onSingle={() => {
            const { mode, income } = scopeDialog
            setScopeDialog(null)
            if (mode === 'delete') {
              handleDeleteSingle(income)
            } else {
              setEditTarget(income)
              setEditScope('single')
            }
          }}
          onFuture={() => {
            const { mode, income } = scopeDialog
            setScopeDialog(null)
            if (mode === 'delete') {
              handleDeleteFuture(income)
            } else {
              setEditTarget(income)
              setEditScope('future')
            }
          }}
        />
      )}

      {/* Edit sheet */}
      {editTarget && (
        <EditIncomeSheet
          income={editTarget}
          scope={editScope}
          onClose={() => { setEditTarget(null); setEditScope(null) }}
        />
      )}
    </Card>
  )
}

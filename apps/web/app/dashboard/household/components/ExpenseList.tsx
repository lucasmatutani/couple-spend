'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Repeat, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import RecurringScopeDialog from '@/components/RecurringScopeDialog'
import { Money } from '@/components/ui/money'
import { deleteExpense } from '../actions'
import { deleteExpenseFuture } from '../recurring-actions'
import type { CategoryDto, ExpenseDto } from '../types'
import EditExpenseSheet from './EditExpenseSheet'

const SPLIT_LABELS: Record<string, string> = {
  EQUAL: 'Igual',
  ONLY_PAYER: 'Só pagador',
  ONLY_OTHER: 'Só outro',
  CUSTOM: 'Personalizado',
}

type Props = {
  expenses: ExpenseDto[]
  categories: CategoryDto[]
  householdId: string
}

type ScopeIntent = { mode: 'edit' | 'delete'; expense: ExpenseDto }

const tbodyVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
}
const rowVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
}

export default function ExpenseList({ expenses, categories, householdId }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<ExpenseDto | null>(null)
  const [editScope, setEditScope] = useState<'single' | 'future' | null>(null)
  const [scopeIntent, setScopeIntent] = useState<ScopeIntent | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Simple delete (non-recurring or scope='single')
  async function handleDeleteConfirmed() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteExpense(deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
  }

  // Delete this + all future entries of the recurring series
  async function handleDeleteFuture(expense: ExpenseDto) {
    if (!expense.recurringExpenseId) return
    setDeleting(true)
    await deleteExpenseFuture(expense.recurringExpenseId, expense.occurredAt)
    setDeleting(false)
  }

  function onClickDelete(expense: ExpenseDto) {
    if (expense.recurringExpenseId) {
      setScopeIntent({ mode: 'delete', expense })
    } else {
      setDeleteTarget(expense.id)
    }
  }

  function onClickEdit(expense: ExpenseDto) {
    if (expense.recurringExpenseId) {
      setScopeIntent({ mode: 'edit', expense })
    } else {
      setEditTarget(expense)
      setEditScope(null)
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>Nenhuma despesa neste mês.</p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Divisão</TableHead>
              <TableHead>Pago por</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[72px]" />
            </TableRow>
          </TableHeader>
          <motion.tbody
            initial="hidden"
            animate="visible"
            variants={tbodyVariants}
            className="[&_tr:last-child]:border-0"
          >
            {expenses.map((expense) => (
              <motion.tr
                key={expense.id}
                variants={rowVariants}
                className="border-b transition-colors hover:bg-muted/50"
              >
                <TableCell className="whitespace-nowrap">{expense.occurredAt}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    {expense.recurringExpenseId && (
                      <Repeat className="h-3 w-3 shrink-0 text-muted-foreground" />
                    )}
                    {expense.description ?? '—'}
                  </span>
                </TableCell>
                <TableCell>{expense.categoryName}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {SPLIT_LABELS[expense.splitRuleType] ?? expense.splitRuleType}
                  </Badge>
                </TableCell>
                <TableCell>{expense.paidByDisplayName}</TableCell>
                <TableCell className="text-right">
                  <Money cents={expense.amountCents} size="sm" className="font-medium !text-foreground" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => onClickEdit(expense)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onClickDelete(expense)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </motion.tbody>
        </Table>
      </div>

      {/* Scope dialog for recurring expenses */}
      {scopeIntent && (
        <RecurringScopeDialog
          mode={scopeIntent.mode}
          open={!!scopeIntent}
          onCancel={() => setScopeIntent(null)}
          onSingle={() => {
            const { mode, expense } = scopeIntent
            setScopeIntent(null)
            if (mode === 'delete') {
              setDeleteTarget(expense.id)
            } else {
              setEditTarget(expense)
              setEditScope('single')
            }
          }}
          onFuture={() => {
            const { mode, expense } = scopeIntent
            setScopeIntent(null)
            if (mode === 'delete') {
              handleDeleteFuture(expense)
            } else {
              setEditTarget(expense)
              setEditScope('future')
            }
          }}
        />
      )}

      {/* Simple delete confirmation (non-recurring or single) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>Esta ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirmed} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit sheet */}
      {editTarget && (
        <EditExpenseSheet
          expense={editTarget}
          categories={categories}
          householdId={householdId}
          scope={editScope}
          onClose={() => { setEditTarget(null); setEditScope(null) }}
        />
      )}
    </>
  )
}

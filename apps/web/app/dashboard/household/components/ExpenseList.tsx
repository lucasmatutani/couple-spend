'use client'

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
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
import { deleteExpense } from '../actions'
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

export default function ExpenseList({ expenses, categories, householdId }: Props) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<ExpenseDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await deleteExpense(deleteTarget)
    setDeleting(false)
    setDeleteTarget(null)
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
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="whitespace-nowrap">{expense.occurredAt}</TableCell>
                <TableCell>{expense.description ?? '—'}</TableCell>
                <TableCell>{expense.categoryName}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {SPLIT_LABELS[expense.splitRuleType] ?? expense.splitRuleType}
                  </Badge>
                </TableCell>
                <TableCell>{expense.paidByDisplayName}</TableCell>
                <TableCell className="text-right font-medium">{expense.amountFormatted}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditTarget(expense)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(expense.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
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
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
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
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  )
}

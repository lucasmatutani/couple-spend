'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Pencil, Upload, Trash2, X, Check, PieChart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ImportInvoiceDialog from './ImportInvoiceSheet'
import CreditCardCategoryChart from './CreditCardCategoryChart'
import { updateCreditCardExpense, deleteCreditCardMonth } from '../actions'
import type { CategoryDto, PersonalExpenseDto } from '../types'

function getSplitOptions(otherMemberName: string | null) {
  return [
    { value: '1', label: 'Só eu' },
    ...(otherMemberName ? [{ value: 'partner', label: `Dividir com ${otherMemberName}` }] : []),
    { value: '2', label: '÷ 2 pessoas' },
    { value: '3', label: '÷ 3 pessoas' },
    { value: '4', label: '÷ 4 pessoas' },
    { value: '5', label: '÷ 5 pessoas' },
    { value: 'reimbursed', label: 'Reembolso total' },
  ]
}

function fmt(cents: number): string {
  return `R$ ${(Math.abs(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function centsToBrl(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function parseBrl(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100)
}

function effectiveCents(e: PersonalExpenseDto): number {
  if (e.reimbursed) return 0
  const isRefund = e.categoryName === 'Reembolsos'
  if (isRefund) return -e.amountCents
  return Math.round(e.amountCents / e.splitParts)
}

type Props = {
  expenses: PersonalExpenseDto[]
  categories: CategoryDto[]
  currentMonth: string
  otherMemberName: string | null
}

type EditState = {
  categoryId: string
  amountBrl: string
  /** '1'..'10', 'partner', or 'reimbursed' */
  splitParts: string
  saving: boolean
  error: string | null
}

export default function CreditCardExpensesCard({ expenses, categories, currentMonth, otherMemberName }: Props) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showChart, setShowChart] = useState(false)

  const ccExpenses = expenses.filter((e) => e.paymentMethod === 'credit_card')
  const totalCents = ccExpenses.reduce((sum, e) => sum + effectiveCents(e), 0)

  function startEdit(e: PersonalExpenseDto) {
    setEditingId(e.id)
    const splitValue = e.reimbursed ? 'reimbursed' : e.splitWithPartner ? 'partner' : String(e.splitParts)
    setEditState({
      categoryId: e.categoryId,
      amountBrl: centsToBrl(e.amountCents),
      splitParts: splitValue,
      saving: false,
      error: null,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
  }

  async function saveEdit(e: PersonalExpenseDto) {
    if (!editState) return
    const amountCents = parseBrl(editState.amountBrl)
    if (!amountCents || amountCents <= 0) {
      setEditState((s) => s && ({ ...s, error: 'Valor inválido' }))
      return
    }
    const isReimbursed = editState.splitParts === 'reimbursed'
    const isPartnerSplit = editState.splitParts === 'partner'
    setEditState((s) => s && ({ ...s, saving: true, error: null }))
    const result = await updateCreditCardExpense({
      id: e.id,
      categoryId: editState.categoryId,
      amountCents,
      splitParts: isPartnerSplit ? 2 : isReimbursed ? 1 : parseInt(editState.splitParts, 10),
      reimbursed: isReimbursed,
      splitWithPartner: isPartnerSplit,
      description: e.description,
      occurredAt: e.occurredAt,
    })
    if (!result.success) {
      setEditState((s) => s && ({ ...s, saving: false, error: result.error }))
      return
    }
    setEditingId(null)
    setEditState(null)
    router.refresh()
  }

  async function handleDeleteMonth() {
    setDeleting(true)
    await deleteCreditCardMonth(currentMonth)
    setDeleting(false)
    setConfirmDelete(false)
    router.refresh()
  }

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  function formatMonth(ym: string): string {
    const [y, m] = ym.split('-') as [string, string]
    return `${MONTHS[parseInt(m, 10) - 1]} de ${y}`
  }

  return (
    <>
      <CreditCardCategoryChart
        open={showChart}
        onClose={() => setShowChart(false)}
        expenses={expenses}
      />

      {/* Confirmation dialog */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Apagar fatura de {formatMonth(currentMonth)}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso vai remover todos os lançamentos de cartão de crédito de{' '}
            <span className="font-medium text-foreground">{formatMonth(currentMonth)}</span>,
            incluindo os divididos com a casa. Essa ação não pode ser desfeita.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteMonth} disabled={deleting}>
              {deleting ? 'Apagando…' : 'Apagar tudo'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Cartão de crédito
          {ccExpenses.length > 0 && (
            <span className={`text-sm font-semibold ${totalCents < 0 ? 'text-green-600' : ''}`}>
              {totalCents < 0 ? '-' : ''}{fmt(totalCents)}
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {ccExpenses.length > 0 && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setShowChart(true)}
                title="Ver gráfico por categoria"
              >
                <PieChart className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          <ImportInvoiceDialog
            currentMonth={currentMonth}
            trigger={
              <Button size="sm" variant="outline" className="gap-1 h-8 shrink-0">
                <Upload className="h-3 w-3" />
                Importar fatura
              </Button>
            }
          />
        </div>
      </CardHeader>

      <CardContent>
        {ccExpenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma despesa de cartão de crédito neste período.
          </p>
        ) : (
          <div className="space-y-1">
            {ccExpenses.map((expense) => {
              const isRefund = expense.categoryName === 'Reembolsos'
              const isReimbursed = expense.reimbursed
              const isPartnerSplit = expense.splitWithPartner
              const isSplit = !isReimbursed && !isPartnerSplit && expense.splitParts > 1
              const effective = effectiveCents(expense)
              const isEditing = editingId === expense.id

              if (isEditing && editState) {
                return (
                  <div
                    key={expense.id}
                    className="rounded-md border border-primary/30 bg-muted/30 p-3 space-y-3"
                  >
                    <p className="text-sm font-medium truncate">{expense.description ?? '—'}</p>

                    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-end">
                      {/* Category */}
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Categoria</p>
                        <Select
                          value={editState.categoryId}
                          onValueChange={(v) => setEditState((s) => s && ({ ...s, categoryId: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Amount */}
                      <div className="space-y-1 w-28">
                        <p className="text-xs text-muted-foreground">Valor (R$)</p>
                        <Input
                          className="h-8 text-xs"
                          value={editState.amountBrl}
                          onChange={(e) => setEditState((s) => s && ({ ...s, amountBrl: e.target.value }))}
                          inputMode="decimal"
                        />
                      </div>

                      {/* Split */}
                      <div className="space-y-1 w-36">
                        <p className="text-xs text-muted-foreground">Dividir com</p>
                        <Select
                          value={editState.splitParts}
                          onValueChange={(v) => setEditState((s) => s && ({ ...s, splitParts: v }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getSplitOptions(otherMemberName).map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {editState.error && (
                      <p className="text-xs text-destructive">{editState.error}</p>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={cancelEdit}
                        disabled={editState.saving}
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => saveEdit(expense)}
                        disabled={editState.saving}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {editState.saving ? 'Salvando…' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                )
              }

              return (
                <div
                  key={expense.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40 group"
                >
                  {/* Description + date */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{expense.description ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{expense.occurredAt}</p>
                  </div>

                  {/* Category badge */}
                  <Badge variant="secondary" className="text-xs shrink-0 hidden sm:inline-flex">
                    {expense.categoryName}
                  </Badge>

                  {/* Split / reimbursed badge */}
                  {isReimbursed ? (
                    <Badge variant="outline" className="text-xs shrink-0 text-orange-600 border-orange-200">
                      Reembolso
                    </Badge>
                  ) : isPartnerSplit ? (
                    <Badge variant="outline" className="text-xs shrink-0 text-blue-600 border-blue-200">
                      ÷ {otherMemberName ?? 'parceiro'}
                    </Badge>
                  ) : isSplit ? (
                    <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground border-muted">
                      ÷{expense.splitParts}
                    </Badge>
                  ) : null}

                  {/* Amount column */}
                  <div className="text-right shrink-0">
                    {isReimbursed ? (
                      <>
                        <p className="text-sm font-medium text-muted-foreground">R$ 0,00</p>
                        <p className="text-xs text-muted-foreground line-through">{fmt(expense.amountCents)}</p>
                      </>
                    ) : isPartnerSplit || isSplit ? (
                      <>
                        <p className={`text-sm font-medium ${isRefund ? 'text-green-600' : ''}`}>
                          {isRefund ? '-' : ''}{fmt(effective)}
                        </p>
                        <p className="text-xs text-muted-foreground line-through">
                          {fmt(expense.amountCents)}
                        </p>
                      </>
                    ) : (
                      <p className={`text-sm font-medium ${isRefund ? 'text-green-600' : ''}`}>
                        {isRefund ? '-' : ''}{fmt(expense.amountCents)}
                      </p>
                    )}
                  </div>

                  {/* Edit button */}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => startEdit(expense)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}

            {/* Footer total */}
            <div className="border-t pt-2 mt-2 flex items-center justify-between text-sm font-medium">
              <span className="text-muted-foreground">
                {ccExpenses.length} lançamento{ccExpenses.length !== 1 ? 's' : ''}
              </span>
              <span className={totalCents < 0 ? 'text-green-600' : ''}>
                {totalCents < 0 ? '-' : ''}{fmt(totalCents)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
    </>
  )
}

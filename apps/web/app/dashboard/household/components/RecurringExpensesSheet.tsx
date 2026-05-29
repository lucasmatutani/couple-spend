'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import RecurringScopeDialog from '@/components/RecurringScopeDialog'
import {
  addRecurringExpense,
  deactivateRecurringTemplate,
  updateRecurringExpenseTemplate,
  updateRecurringExpenseSingleMonth,
} from '../recurring-actions'
import type { CategoryDto, RecurringExpenseDto } from '../types'

function parseBrl(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100)
}
function centsToBrl(n: number): string {
  return (n / 100).toFixed(2).replace('.', ',')
}

type FormState = {
  description: string
  amountBrl: string
  categoryId: string
  splitType: string
  payerPercent: string
  isInstallment: boolean
  installmentCount: string
}

function emptyForm(defaultCategoryId: string): FormState {
  return {
    description: '',
    amountBrl: '',
    categoryId: defaultCategoryId,
    splitType: 'EQUAL',
    payerPercent: '',
    isInstallment: false,
    installmentCount: '',
  }
}

function fromItem(item: RecurringExpenseDto): FormState {
  return {
    description: item.description,
    amountBrl: centsToBrl(item.amountCents),
    categoryId: item.categoryId,
    splitType: item.splitRuleType,
    payerPercent: item.splitRulePayerPercent?.toString() ?? '',
    isInstallment: false, // installment count not editable
    installmentCount: '',
  }
}

type Props = {
  householdId: string
  categories: CategoryDto[]
  recurringExpenses: RecurringExpenseDto[]
  currentMonth: string
}

export default function RecurringExpensesSheet({
  householdId,
  categories,
  recurringExpenses,
  currentMonth,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editScope, setEditScope] = useState<'single' | 'future' | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  const [addForm, setAddForm] = useState<FormState>(() => emptyForm(categories[0]?.id ?? ''))
  const [editForm, setEditForm] = useState<FormState>(() => emptyForm(categories[0]?.id ?? ''))

  const visibleItems = recurringExpenses.filter((i) => !deletedIds.has(i.id))

  function startEdit(item: RecurringExpenseDto) {
    // Show scope dialog first; the inline form only opens after scope is chosen
    setEditingId(item.id)
    setEditScope(null)
    setEditForm(fromItem(item))
    setFormError('')
    setShowAddForm(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditScope(null)
    setFormError('')
  }

  async function handleDeactivate(id: string) {
    setDeletedIds((prev) => new Set([...prev, id]))
    const result = await deactivateRecurringTemplate(id, currentMonth)
    if (!result.success) {
      setDeletedIds((prev) => { const s = new Set(prev); s.delete(id); return s })
    } else {
      router.refresh()
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const f = addForm
    if (!f.description.trim()) { setFormError('Descrição obrigatória'); return }
    if (!f.amountBrl) { setFormError('Valor obrigatório'); return }
    const parsedInstallments = f.isInstallment ? parseInt(f.installmentCount, 10) : null
    if (f.isInstallment && (isNaN(parsedInstallments!) || parsedInstallments! < 1)) {
      setFormError('Informe um número de parcelas válido.'); return
    }
    setFormLoading(true)
    const result = await addRecurringExpense({
      householdId,
      categoryId: f.categoryId,
      amountCents: parseBrl(f.amountBrl),
      description: f.description.trim(),
      splitRuleType: f.splitType as 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM',
      splitRulePayerPercent: f.splitType === 'CUSTOM' ? parseFloat(f.payerPercent) : null,
      installmentCount: parsedInstallments,
    })
    setFormLoading(false)
    if (result.success) {
      setShowAddForm(false)
      setAddForm(emptyForm(categories[0]?.id ?? ''))
      router.refresh()
    } else {
      setFormError(result.error)
    }
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editScope) return
    setFormError('')
    const f = editForm
    if (!f.description.trim()) { setFormError('Descrição obrigatória'); return }
    if (!f.amountBrl) { setFormError('Valor obrigatório'); return }
    setFormLoading(true)

    const payload = {
      categoryId: f.categoryId,
      amountCents: parseBrl(f.amountBrl),
      description: f.description.trim(),
      splitRuleType: f.splitType as 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM',
      splitRulePayerPercent: f.splitType === 'CUSTOM' ? parseFloat(f.payerPercent) : null,
    }

    const result = editScope === 'single'
      ? await updateRecurringExpenseSingleMonth({ templateId: editingId, month: currentMonth, ...payload })
      : await updateRecurringExpenseTemplate({ id: editingId, ...payload })

    setFormLoading(false)
    if (result.success) {
      setEditingId(null)
      setEditScope(null)
      router.refresh()
    } else {
      setFormError(result.error)
    }
  }

  function setAdd(field: keyof FormState, value: string | boolean) {
    setAddForm((prev) => ({ ...prev, [field]: value }))
  }
  function setEdit(field: keyof FormState, value: string | boolean) {
    setEditForm((prev) => ({ ...prev, [field]: value }))
  }

  function renderFormFields(
    f: FormState,
    set: (k: keyof FormState, v: string | boolean) => void,
    idPrefix: string,
    showInstallment: boolean,
  ) {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-desc`}>Descrição</Label>
          <Input id={`${idPrefix}-desc`} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Ex: Aluguel" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-amount`}>Valor (R$)</Label>
          <Input id={`${idPrefix}-amount`} value={f.amountBrl} onChange={(e) => set('amountBrl', e.target.value)} placeholder="0,00" inputMode="decimal" />
        </div>
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={f.categoryId} onValueChange={(v) => set('categoryId', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Divisão</Label>
          <Select value={f.splitType} onValueChange={(v) => set('splitType', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EQUAL">Igual</SelectItem>
              <SelectItem value="ONLY_PAYER">Só pagador</SelectItem>
              <SelectItem value="ONLY_OTHER">Só outro</SelectItem>
              <SelectItem value="CUSTOM">Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {f.splitType === 'CUSTOM' && (
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-pct`}>% do pagador</Label>
            <Input id={`${idPrefix}-pct`} type="number" min={0} max={100} value={f.payerPercent} onChange={(e) => set('payerPercent', e.target.value)} placeholder="50" />
          </div>
        )}
        {showInstallment && (
          <>
            <div className="flex items-center gap-2">
              <input
                id={`${idPrefix}-installment`}
                type="checkbox"
                checked={f.isInstallment}
                onChange={(e) => { set('isInstallment', e.target.checked); set('installmentCount', '') }}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor={`${idPrefix}-installment`} className="cursor-pointer">Parcelado</Label>
            </div>
            {f.isInstallment && (
              <div className="space-y-2">
                <Label htmlFor={`${idPrefix}-installment-count`}>Número de parcelas</Label>
                <Input id={`${idPrefix}-installment-count`} type="number" min={1} value={f.installmentCount} onChange={(e) => set('installmentCount', e.target.value)} placeholder="Ex: 12" />
              </div>
            )}
          </>
        )}
      </>
    )
  }

  return (
    <>
    {/* Scope dialog — shown when an item is selected for edit but scope not yet chosen */}
    {editingId && editScope === null && (
      <RecurringScopeDialog
        mode="edit"
        open
        onCancel={cancelEdit}
        onSingle={() => setEditScope('single')}
        onFuture={() => setEditScope('future')}
      />
    )}

    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setShowAddForm(false); setEditingId(null); setEditScope(null); setFormError('') } }}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Repeat className="h-4 w-4" />
          Fixas
        </Button>
      </SheetTrigger>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Despesas fixas</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground mt-1">
          Geradas automaticamente todo mês até dezembro. Aparecem na lista de despesas.
        </p>

        <div className="flex-1 overflow-y-auto mt-4 space-y-3">
          {visibleItems.length === 0 && !showAddForm && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma despesa fixa ativa.</p>
          )}

          {visibleItems.map((item) =>
            editingId === item.id && editScope !== null ? (
              <form key={item.id} onSubmit={handleEditSave} className="space-y-4 rounded-lg border p-4 bg-accent/30">
                <div>
                  <p className="text-sm font-semibold">Editar despesa fixa</p>
                  <p className="text-xs text-muted-foreground">
                    {editScope === 'single' ? `Somente ${currentMonth}` : 'Este e todos os próximos meses'}
                  </p>
                </div>
                {renderFormFields(editForm, setEdit, 'edit', false)}
                {formError && <p className="text-xs text-destructive">{formError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={formLoading}>
                    {formLoading ? 'Salvando...' : 'Salvar'}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit}>Cancelar</Button>
                </div>
              </form>
            ) : (
              <div key={item.id} className="flex items-center gap-2 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.categoryName} · {item.amountFormatted}
                    {item.installmentCount !== null && (
                      <> · <span className="font-medium">{item.installmentCount}x</span></>
                    )}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => startEdit(item)} className="shrink-0 text-muted-foreground hover:text-foreground">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Desativar a partir do mês atual" onClick={() => handleDeactivate(item.id)} className="shrink-0 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          )}

          {!showAddForm && !editingId && (
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" />
              Nova despesa fixa
            </Button>
          )}

          {showAddForm && (
            <form onSubmit={handleAdd} className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-semibold">Nova despesa fixa</p>
              {renderFormFields(addForm, setAdd, 'add', true)}
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={formLoading}>
                  {formLoading ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowAddForm(false); setFormError('') }}>Cancelar</Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  )
}

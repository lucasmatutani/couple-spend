'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Repeat, Trash2 } from 'lucide-react'
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
import { addRecurringExpense, deactivateRecurringTemplate } from '../recurring-actions'
import type { CategoryDto, RecurringExpenseDto } from '../types'

function parseBrl(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100)
}

type Props = {
  householdId: string
  categories: CategoryDto[]
  recurringExpenses: RecurringExpenseDto[]
  currentMonth: string // "YYYY-MM"
}

export default function RecurringExpensesSheet({
  householdId,
  categories,
  recurringExpenses,
  currentMonth,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  const [description, setDescription] = useState('')
  const [amountBrl, setAmountBrl] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [splitType, setSplitType] = useState('EQUAL')
  const [payerPercent, setPayerPercent] = useState('')

  const visibleItems = recurringExpenses.filter((i) => !deletedIds.has(i.id))

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
    if (!description.trim()) { setFormError('Descrição obrigatória'); return }
    if (!amountBrl) { setFormError('Valor obrigatório'); return }

    setFormLoading(true)
    const result = await addRecurringExpense({
      householdId,
      categoryId,
      amountCents: parseBrl(amountBrl),
      description: description.trim(),
      splitRuleType: splitType as 'EQUAL' | 'ONLY_PAYER' | 'ONLY_OTHER' | 'CUSTOM',
      splitRulePayerPercent: splitType === 'CUSTOM' ? parseFloat(payerPercent) : null,
    })
    setFormLoading(false)

    if (result.success) {
      setShowForm(false)
      setDescription('')
      setAmountBrl('')
      setSplitType('EQUAL')
      setPayerPercent('')
      router.refresh()
    } else {
      setFormError(result.error)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setShowForm(false); setFormError('') } }}>
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
          {visibleItems.length === 0 && !showForm && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma despesa fixa ativa.
            </p>
          )}

          {visibleItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.description}</p>
                <p className="text-xs text-muted-foreground">
                  {item.categoryName} · {item.amountFormatted}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                title="Desativar a partir do mês atual"
                onClick={() => handleDeactivate(item.id)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {!showForm && (
            <Button variant="outline" className="w-full gap-2" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Nova despesa fixa
            </Button>
          )}

          {showForm && (
            <form onSubmit={handleAdd} className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-semibold">Nova despesa fixa</p>

              <div className="space-y-2">
                <Label htmlFor="rec-desc">Descrição</Label>
                <Input id="rec-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Aluguel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rec-amount">Valor (R$)</Label>
                <Input id="rec-amount" value={amountBrl} onChange={(e) => setAmountBrl(e.target.value)} placeholder="0,00" inputMode="decimal" />
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Divisão</Label>
                <Select value={splitType} onValueChange={setSplitType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EQUAL">Igual</SelectItem>
                    <SelectItem value="ONLY_PAYER">Só pagador</SelectItem>
                    <SelectItem value="ONLY_OTHER">Só outro</SelectItem>
                    <SelectItem value="CUSTOM">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {splitType === 'CUSTOM' && (
                <div className="space-y-2">
                  <Label htmlFor="rec-pct">% do pagador</Label>
                  <Input id="rec-pct" type="number" min={0} max={100} value={payerPercent} onChange={(e) => setPayerPercent(e.target.value)} placeholder="50" />
                </div>
              )}
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={formLoading}>
                  {formLoading ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); setFormError('') }}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

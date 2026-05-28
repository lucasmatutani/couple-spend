'use client'

import { useEffect, useState } from 'react'
import { z } from 'zod'
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { updateExpense } from '../actions'
import type { CategoryDto, ExpenseDto } from '../types'

const formSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória'),
  amountBrl: z.string().regex(/^\d+([,\.]\d{1,2})?$/, 'Valor inválido'),
  occurredAt: z.string().min(1, 'Data obrigatória'),
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  splitRuleType: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
  splitRulePayerPercent: z.number().min(0).max(100).nullable(),
})

function centsToBrl(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function parseBrl(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100)
}

type Props = {
  expense: ExpenseDto
  categories: CategoryDto[]
  householdId: string
  onClose: () => void
}

export default function EditExpenseSheet({ expense, categories, householdId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [splitType, setSplitType] = useState(expense.splitRuleType)
  const [payerPercent, setPayerPercent] = useState(
    expense.splitRulePayerPercent?.toString() ?? '',
  )
  const [form, setForm] = useState({
    description: expense.description ?? '',
    amountBrl: centsToBrl(expense.amountCents),
    occurredAt: expense.occurredAt,
    categoryId: expense.categoryId,
  })

  // Reset when the expense changes
  useEffect(() => {
    setForm({
      description: expense.description ?? '',
      amountBrl: centsToBrl(expense.amountCents),
      occurredAt: expense.occurredAt,
      categoryId: expense.categoryId,
    })
    setSplitType(expense.splitRuleType)
    setPayerPercent(expense.splitRulePayerPercent?.toString() ?? '')
    setErrors({})
  }, [expense])

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const raw = {
      description: form.description,
      amountBrl: form.amountBrl,
      occurredAt: form.occurredAt,
      categoryId: form.categoryId,
      splitRuleType: splitType as z.infer<typeof formSchema>['splitRuleType'],
      splitRulePayerPercent: splitType === 'CUSTOM' ? parseFloat(payerPercent) : null,
    }
    const parsed = formSchema.safeParse(raw)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<string, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString()
        if (key) fieldErrors[key] = issue.message
      }
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    setLoading(true)
    const result = await updateExpense({
      id: expense.id,
      householdId,
      categoryId: parsed.data.categoryId,
      occurredAt: parsed.data.occurredAt,
      amountCents: parseBrl(parsed.data.amountBrl),
      description: parsed.data.description || null,
      splitRuleType: parsed.data.splitRuleType,
      splitRulePayerPercent: parsed.data.splitRulePayerPercent,
    })
    setLoading(false)
    if (result.success) onClose()
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar despesa</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-description">Descrição</Label>
            <Input
              id="edit-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
            {errors['description'] && (
              <p className="text-xs text-destructive">{errors['description']}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-amount">Valor (R$)</Label>
            <Input
              id="edit-amount"
              value={form.amountBrl}
              onChange={(e) => set('amountBrl', e.target.value)}
              inputMode="decimal"
            />
            {errors['amountBrl'] && (
              <p className="text-xs text-destructive">{errors['amountBrl']}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-date">Data</Label>
            <Input
              id="edit-date"
              type="date"
              value={form.occurredAt}
              onChange={(e) => set('occurredAt', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.categoryId} onValueChange={(v) => set('categoryId', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Divisão</Label>
            <Select value={splitType} onValueChange={setSplitType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
              <Label htmlFor="edit-payer-pct">% do pagador</Label>
              <Input
                id="edit-payer-pct"
                type="number"
                min={0}
                max={100}
                value={payerPercent}
                onChange={(e) => setPayerPercent(e.target.value)}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

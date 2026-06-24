'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { addExpense } from '../actions'
import type { CategoryDto } from '../types'

const formSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória'),
  amountBrl: z.string().regex(/^\d+([,\.]\d{1,2})?$/, 'Valor inválido'),
  occurredAt: z.string().min(1, 'Data obrigatória'),
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  splitRuleType: z.enum(['EQUAL', 'ONLY_PAYER', 'ONLY_OTHER', 'CUSTOM']),
  splitRulePayerPercent: z.number().min(0).max(100).nullable(),
})

function parseBrl(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100)
}

function defaultDateForMonth(currentMonth: string): string {
  const today = new Date().toISOString().split('T')[0]!
  const todayMonth = today.slice(0, 7)
  if (todayMonth === currentMonth) return today
  return `${currentMonth}-01`
}

type Props = {
  householdId: string
  categories: CategoryDto[]
  currentUserName: string
  otherMemberName: string | null
  currentMonth: string
}

export default function AddExpenseSheet({ householdId, categories, currentUserName, otherMemberName, currentMonth }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [splitType, setSplitType] = useState<string>('EQUAL')
  const [payerPercent, setPayerPercent] = useState('')

  const [form, setForm] = useState({
    description: '',
    amountBrl: '',
    occurredAt: defaultDateForMonth(currentMonth),
    categoryId: categories[0]?.id ?? '',
  })

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
    const result = await addExpense({
      householdId,
      categoryId: parsed.data.categoryId,
      occurredAt: parsed.data.occurredAt,
      amountCents: parseBrl(parsed.data.amountBrl),
      description: parsed.data.description || null,
      splitRuleType: parsed.data.splitRuleType,
      splitRulePayerPercent: parsed.data.splitRulePayerPercent,
    })
    setLoading(false)
    if (result.success) {
      setOpen(false)
      setForm({ description: '', amountBrl: '', occurredAt: defaultDateForMonth(currentMonth), categoryId: categories[0]?.id ?? '' })
      setSplitType('EQUAL')
      setPayerPercent('')
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nova despesa</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-description">Descrição</Label>
            <Input
              id="add-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Ex: Supermercado"
            />
            {errors['description'] && <p className="text-xs text-destructive">{errors['description']}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-amount">Valor (R$)</Label>
            <Input
              id="add-amount"
              value={form.amountBrl}
              onChange={(e) => set('amountBrl', e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
            {errors['amountBrl'] && <p className="text-xs text-destructive">{errors['amountBrl']}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="add-date">Data</Label>
            <Input
              id="add-date"
              type="date"
              value={form.occurredAt}
              onChange={(e) => set('occurredAt', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.categoryId} onValueChange={(v) => set('categoryId', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors['categoryId'] && <p className="text-xs text-destructive">{errors['categoryId']}</p>}
          </div>

          <div className="space-y-2">
            <Label>Divisão</Label>
            <Select value={splitType} onValueChange={setSplitType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EQUAL">Igual</SelectItem>
                <SelectItem value="ONLY_PAYER">Só {currentUserName}</SelectItem>
                <SelectItem value="ONLY_OTHER">Só {otherMemberName ?? 'outro'}</SelectItem>
                <SelectItem value="CUSTOM">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {splitType === 'CUSTOM' && (
            <div className="space-y-2">
              <Label htmlFor="add-payer-pct">% do pagador</Label>
              <Input
                id="add-payer-pct"
                type="number"
                min={0}
                max={100}
                value={payerPercent}
                onChange={(e) => setPayerPercent(e.target.value)}
                placeholder="50"
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

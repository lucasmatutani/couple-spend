'use client'

import { useState } from 'react'
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
import { addPersonalExpense } from '../actions'
import type { CategoryDto } from '../types'

const PAYMENT_METHODS = [
  { value: 'credit_card', label: 'Cartão de crédito' },
  { value: 'debit', label: 'Cartão de débito' },
  { value: 'pix', label: 'Pix' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'other', label: 'Outro' },
] as const

const formSchema = z.object({
  categoryId: z.string().min(1, 'Categoria obrigatória'),
  amountBrl: z.string().regex(/^\d+([,\.]\d{1,2})?$/, 'Valor inválido'),
  occurredAt: z.string().min(1, 'Data obrigatória'),
  description: z.string(),
  paymentMethod: z.string().nullable(),
})

function parseBrl(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100)
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!
}

type Props = {
  categories: CategoryDto[]
  trigger: React.ReactNode
}

export default function AddPersonalExpenseSheet({ categories, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [form, setForm] = useState({
    categoryId: categories[0]?.id ?? '',
    amountBrl: '',
    occurredAt: todayIso(),
    description: '',
    paymentMethod: 'credit_card' as string | null,
  })

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = formSchema.safeParse(form)
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
    const result = await addPersonalExpense({
      categoryId: parsed.data.categoryId,
      occurredAt: parsed.data.occurredAt,
      amountCents: parseBrl(parsed.data.amountBrl),
      description: parsed.data.description || null,
      paymentMethod: parsed.data.paymentMethod || null,
    })
    setLoading(false)
    if (result.success) {
      setOpen(false)
      setForm({ categoryId: categories[0]?.id ?? '', amountBrl: '', occurredAt: todayIso(), description: '', paymentMethod: 'credit_card' })
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nova despesa pessoal</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            <Label htmlFor="pe-amount">Valor (R$)</Label>
            <Input
              id="pe-amount"
              value={form.amountBrl}
              onChange={(e) => set('amountBrl', e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
            {errors['amountBrl'] && <p className="text-xs text-destructive">{errors['amountBrl']}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="pe-date">Data</Label>
            <Input
              id="pe-date"
              type="date"
              value={form.occurredAt}
              onChange={(e) => set('occurredAt', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pe-description">Descrição (opcional)</Label>
            <Input
              id="pe-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Ex: Farmácia"
            />
          </div>

          <div className="space-y-2">
            <Label>Meio de pagamento</Label>
            <Select
              value={form.paymentMethod ?? ''}
              onValueChange={(v) => set('paymentMethod', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value}>
                    {pm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

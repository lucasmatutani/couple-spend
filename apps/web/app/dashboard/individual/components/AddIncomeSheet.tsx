'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { addIncome } from '../actions'

const formSchema = z.object({
  source: z.string().min(1, 'Fonte obrigatória'),
  amountBrl: z.string().regex(/^\d+([,\.]\d{1,2})?$/, 'Valor inválido'),
  occurredAt: z.string().min(1, 'Data obrigatória'),
  recurring: z.boolean(),
})

function parseBrl(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100)
}

function defaultDate(monthParam: string | null): string {
  if (!monthParam) return new Date().toISOString().split('T')[0]!
  const [y, m] = monthParam.split('-').map(Number) as [number, number]
  const day = new Date().getDate()
  const lastDay = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`
}

type Props = { trigger: React.ReactNode; currentMonth?: string }

export default function AddIncomeSheet({ trigger, currentMonth }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [form, setForm] = useState({
    source: '',
    amountBrl: '',
    occurredAt: defaultDate(currentMonth ?? null),
    recurring: false,
  })

  function handleOpenChange(next: boolean) {
    if (next) setForm((prev) => ({ ...prev, occurredAt: defaultDate(currentMonth ?? null), recurring: false }))
    setOpen(next)
  }

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
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
    const result = await addIncome({
      occurredAt: parsed.data.occurredAt,
      amountCents: parseBrl(parsed.data.amountBrl),
      source: parsed.data.source,
      recurring: parsed.data.recurring,
    })
    setLoading(false)
    if (result.success) {
      setOpen(false)
      setForm({ source: '', amountBrl: '', occurredAt: defaultDate(currentMonth ?? null), recurring: false })
      router.refresh()
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nova receita</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="income-source">Fonte</Label>
            <Input
              id="income-source"
              value={form.source}
              onChange={(e) => set('source', e.target.value)}
              placeholder="Ex: Salário, Freelance"
            />
            {errors['source'] && <p className="text-xs text-destructive">{errors['source']}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="income-amount">Valor (R$)</Label>
            <Input
              id="income-amount"
              value={form.amountBrl}
              onChange={(e) => set('amountBrl', e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
            {errors['amountBrl'] && <p className="text-xs text-destructive">{errors['amountBrl']}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="income-date">Data</Label>
            <Input
              id="income-date"
              type="date"
              value={form.occurredAt}
              onChange={(e) => set('occurredAt', e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="income-recurring"
              type="checkbox"
              checked={form.recurring}
              onChange={(e) => set('recurring', e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="income-recurring" className="cursor-pointer">Recorrente</Label>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

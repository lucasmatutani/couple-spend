'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { addInvestment } from '../actions'

const ASSET_CLASSES = [
  { value: 'stocks', label: 'Ações' },
  { value: 'fixed_income', label: 'Renda Fixa' },
  { value: 'real_estate', label: 'FIIs' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'other', label: 'Outros' },
] as const

const formSchema = z.object({
  assetClass: z.enum(['stocks', 'fixed_income', 'real_estate', 'crypto', 'other']),
  amountBrl: z.string().regex(/^\d+([,\.]\d{1,2})?$/, 'Valor inválido'),
  occurredAt: z.string().min(1, 'Data obrigatória'),
  description: z.string(),
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

export default function AddInvestmentSheet({ trigger, currentMonth }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [form, setForm] = useState({
    assetClass: 'stocks' as string,
    amountBrl: '',
    occurredAt: defaultDate(currentMonth ?? null),
    description: '',
  })

  function handleOpenChange(next: boolean) {
    if (next) setForm((prev) => ({ ...prev, occurredAt: defaultDate(currentMonth ?? null) }))
    setOpen(next)
  }

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
    const result = await addInvestment({
      occurredAt: parsed.data.occurredAt,
      amountCents: parseBrl(parsed.data.amountBrl),
      assetClass: parsed.data.assetClass,
      description: parsed.data.description || null,
    })
    setLoading(false)
    if (result.success) {
      setOpen(false)
      setForm({ assetClass: 'stocks', amountBrl: '', occurredAt: defaultDate(currentMonth ?? null), description: '' })
      router.refresh()
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Novo investimento</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label>Classe de ativo</Label>
            <Select value={form.assetClass} onValueChange={(v) => set('assetClass', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CLASSES.map((ac) => (
                  <SelectItem key={ac.value} value={ac.value}>
                    {ac.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-amount">Valor (R$)</Label>
            <Input
              id="inv-amount"
              value={form.amountBrl}
              onChange={(e) => set('amountBrl', e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
            {errors['amountBrl'] && <p className="text-xs text-destructive">{errors['amountBrl']}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-date">Data</Label>
            <Input
              id="inv-date"
              type="date"
              value={form.occurredAt}
              onChange={(e) => set('occurredAt', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv-description">Descrição (opcional)</Label>
            <Input
              id="inv-description"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Ex: Tesouro Direto"
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}

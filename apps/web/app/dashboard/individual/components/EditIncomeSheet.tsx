'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { updateIncomeSingle, updateIncomeFuture } from '../actions'
import type { IncomeDto } from '../types'

function centsToBrl(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

function parseBrl(s: string): number {
  return Math.round(parseFloat(s.replace(/\./g, '').replace(',', '.')) * 100)
}

const SCOPE_LABELS: Record<string, string> = {
  single: 'Editar somente este mês',
  future: 'Editar este e todos os próximos',
}

type Props = {
  income: IncomeDto
  scope: 'single' | 'future' | null
  onClose: () => void
}

export default function EditIncomeSheet({ income, scope, onClose }: Props) {
  const [source, setSource] = useState(income.source)
  const [amountBrl, setAmountBrl] = useState(centsToBrl(income.amountCents))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!source.trim()) { setError('Fonte obrigatória'); return }
    if (!amountBrl) { setError('Valor obrigatório'); return }

    const amountCents = parseBrl(amountBrl)
    setLoading(true)

    let result
    if (scope === 'future' && income.recurringIncomeId) {
      result = await updateIncomeFuture({
        recurringIncomeId: income.recurringIncomeId,
        fromOccurredAt: income.occurredAt,
        source: source.trim(),
        amountCents,
      })
    } else {
      result = await updateIncomeSingle({ id: income.id, source: source.trim(), amountCents })
    }

    setLoading(false)
    if (result.success) {
      onClose()
    } else {
      setError(result.error)
    }
  }

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar receita</SheetTitle>
          {scope && <p className="text-xs text-muted-foreground">{SCOPE_LABELS[scope]}</p>}
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-income-source">Fonte</Label>
            <Input
              id="edit-income-source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Ex: Salário, Freelance"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-income-amount">Valor (R$)</Label>
            <Input
              id="edit-income-amount"
              value={amountBrl}
              onChange={(e) => setAmountBrl(e.target.value)}
              inputMode="decimal"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
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

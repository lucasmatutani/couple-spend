'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { createCategory } from './actions'

const BUCKET_OPTIONS = [
  { value: 'needs', label: 'Necessidades' },
  { value: 'wants', label: 'Desejos' },
  { value: 'savings', label: 'Investimentos/Poupança' },
]

const SPLIT_OPTIONS = [
  { value: 'EQUAL', label: 'Dividir igualmente' },
  { value: 'ONLY_PAYER', label: 'Só quem pagou' },
  { value: 'ONLY_OTHER', label: 'Só o outro membro' },
  { value: 'CUSTOM', label: 'Percentual customizado' },
]

export default function CreateCategoryForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [budgetBucket, setBudgetBucket] = useState('needs')
  const [defaultSplitRule, setDefaultSplitRule] = useState('EQUAL')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createCategory({ name, budgetBucket, defaultSplitRule })
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setName('')
    setBudgetBucket('needs')
    setDefaultSplitRule('EQUAL')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="category-name">Nome</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="Ex.: Pet, Presentes, Academia"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo de orçamento</Label>
          <Select value={budgetBucket} onValueChange={setBudgetBucket}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {BUCKET_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Divisão padrão</Label>
          <Select value={defaultSplitRule} onValueChange={setDefaultSplitRule}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SPLIT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading || !name.trim()}>
        {loading ? 'Criando…' : 'Criar categoria'}
      </Button>
    </form>
  )
}

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
import { SPLIT_OPTIONS } from './categoryOptions'

export default function CreateCategoryForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [defaultSplitRule, setDefaultSplitRule] = useState('EQUAL')
  const [keywordsHint, setKeywordsHint] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = await createCategory({
      name,
      defaultSplitRule,
      keywordsHint: keywordsHint || null,
    })
    setLoading(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setName('')
    setDefaultSplitRule('EQUAL')
    setKeywordsHint('')
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

      <div className="space-y-2">
        <Label htmlFor="category-hint">Dicas para a IA (opcional)</Label>
        <Input
          id="category-hint"
          value={keywordsHint}
          onChange={(e) => setKeywordsHint(e.target.value)}
          maxLength={300}
          placeholder="Ex.: Petz, Cobasi, veterinário, pet shop"
        />
        <p className="text-xs text-muted-foreground">
          Nomes de lojas/palavras-chave que ajudam a IA a categorizar essa despesa
          automaticamente ao importar uma fatura.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={loading || !name.trim()}>
        {loading ? 'Criando…' : 'Criar categoria'}
      </Button>
    </form>
  )
}

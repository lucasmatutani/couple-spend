'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateCategory, deleteCategory } from './actions'
import { BUCKET_OPTIONS, SPLIT_OPTIONS, BUCKET_LABELS, SPLIT_LABELS } from './categoryOptions'

export type CategoryDto = {
  id: string
  name: string
  budgetBucket: string
  defaultSplitRule: string
  keywordsHint: string | null
}

type EditState = {
  name: string
  budgetBucket: string
  defaultSplitRule: string
  keywordsHint: string
  saving: boolean
  error: string | null
}

export default function CategoryList({ categories }: { categories: CategoryDto[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function startEdit(c: CategoryDto) {
    setEditingId(c.id)
    setEditState({
      name: c.name,
      budgetBucket: c.budgetBucket,
      defaultSplitRule: c.defaultSplitRule,
      keywordsHint: c.keywordsHint ?? '',
      saving: false,
      error: null,
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
  }

  async function saveEdit(id: string) {
    if (!editState) return
    if (!editState.name.trim()) {
      setEditState((s) => s && ({ ...s, error: 'Nome obrigatório' }))
      return
    }
    setEditState((s) => s && ({ ...s, saving: true, error: null }))
    const result = await updateCategory({
      id,
      name: editState.name,
      budgetBucket: editState.budgetBucket,
      defaultSplitRule: editState.defaultSplitRule,
      keywordsHint: editState.keywordsHint || null,
    })
    if (!result.success) {
      setEditState((s) => s && ({ ...s, saving: false, error: result.error }))
      return
    }
    setEditingId(null)
    setEditState(null)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setDeleteError(null)
    const result = await deleteCategory(id)
    setDeletingId(null)
    setConfirmDeleteId(null)
    if (!result.success) {
      setDeleteError(result.error)
      return
    }
    router.refresh()
  }

  return (
    <div>
      {deleteError && <p className="text-sm text-destructive mb-2">{deleteError}</p>}

      {categories.map((c) => {
        const isEditing = editingId === c.id

        if (isEditing && editState) {
          return (
            <div key={c.id} className="space-y-3 py-3 border-b last:border-0">
              <Input
                autoFocus
                value={editState.name}
                maxLength={60}
                onChange={(e) => setEditState((s) => s && ({ ...s, name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  value={editState.budgetBucket}
                  onValueChange={(v) => setEditState((s) => s && ({ ...s, budgetBucket: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUCKET_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={editState.defaultSplitRule}
                  onValueChange={(v) => setEditState((s) => s && ({ ...s, defaultSplitRule: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SPLIT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                value={editState.keywordsHint}
                maxLength={300}
                placeholder="Dicas para a IA (opcional)"
                onChange={(e) => setEditState((s) => s && ({ ...s, keywordsHint: e.target.value }))}
              />
              {editState.error && <p className="text-xs text-destructive">{editState.error}</p>}
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveEdit(c.id)} disabled={editState.saving}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {editState.saving ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={editState.saving}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancelar
                </Button>
              </div>
            </div>
          )
        }

        return (
          <div key={c.id} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-0 group">
            <p className="text-sm font-medium">{c.name}</p>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{BUCKET_LABELS[c.budgetBucket]}</Badge>
              <Badge variant="outline">{SPLIT_LABELS[c.defaultSplitRule]}</Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => startEdit(c)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {confirmDeleteId === c.id ? (
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                  >
                    {deletingId === c.id ? 'Excluindo…' : 'Confirmar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setConfirmDeleteId(c.id)}
                >
                  Excluir
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

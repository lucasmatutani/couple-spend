'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { deleteSharedBillKeyword, updateSharedBillKeyword } from './actions'

type Keyword = { id: string; keyword: string }

type EditState = {
  value: string
  saving: boolean
  error: string | null
}

export default function SharedBillKeywordsList({ keywords }: { keywords: Keyword[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function startEdit(k: Keyword) {
    setEditingId(k.id)
    setEditState({ value: k.keyword, saving: false, error: null })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
  }

  async function saveEdit(id: string) {
    if (!editState) return
    if (!editState.value.trim()) {
      setEditState((s) => s && ({ ...s, error: 'Palavra-chave inválida' }))
      return
    }
    setEditState((s) => s && ({ ...s, saving: true, error: null }))
    const result = await updateSharedBillKeyword({ id, keyword: editState.value })
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
    await deleteSharedBillKeyword(id)
    setDeletingId(null)
    router.refresh()
  }

  return (
    <div>
      {keywords.map((k) => {
        const isEditing = editingId === k.id

        if (isEditing && editState) {
          return (
            <div key={k.id} className="flex items-center gap-2 py-2 border-b last:border-0">
              <Input
                autoFocus
                className="h-8 text-sm"
                value={editState.value}
                maxLength={60}
                onChange={(e) => setEditState((s) => s && ({ ...s, value: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(k.id)
                  if (e.key === 'Escape') cancelEdit()
                }}
              />
              {editState.error && <p className="text-xs text-destructive shrink-0">{editState.error}</p>}
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => saveEdit(k.id)}
                disabled={editState.saving}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={cancelEdit}
                disabled={editState.saving}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        }

        return (
          <div key={k.id} className="flex items-center justify-between gap-4 py-2 border-b last:border-0 group">
            <p className="text-sm font-medium">{k.keyword}</p>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => startEdit(k)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => handleDelete(k.id)}
                disabled={deletingId === k.id}
              >
                {deletingId === k.id ? 'Apagando…' : 'Excluir'}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

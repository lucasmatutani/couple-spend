'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { deletePersonalExpense } from '../actions'
import AddPersonalExpenseSheet from './AddPersonalExpenseSheet'
import type { CategoryDto, PersonalExpenseDto } from '../types'

const BUCKET_LABELS: Record<string, string> = {
  needs: 'Necessidade',
  wants: 'Desejo',
  savings: 'Poupança',
}

const BUCKET_COLORS: Record<string, string> = {
  needs: 'bg-orange-400',
  wants: 'bg-purple-400',
  savings: 'bg-teal-400',
}

const BUCKET_BADGE_VARIANT = {
  needs: 'default',
  wants: 'secondary',
  savings: 'outline',
} as const

type Props = {
  expenses: PersonalExpenseDto[]
  categories: CategoryDto[]
  totalIncomeCents: number
}

type Filter = 'all' | 'needs' | 'wants' | 'savings'

export default function CategoryBreakdown({ expenses, categories, totalIncomeCents }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    await deletePersonalExpense(id)
    setDeleting(null)
  }

  // Aggregate by category
  type CategorySummary = {
    categoryId: string
    categoryName: string
    budgetBucket: string
    totalCents: number
    expenses: PersonalExpenseDto[]
  }

  const byCategory = new Map<string, CategorySummary>()
  for (const e of expenses) {
    const existing = byCategory.get(e.categoryId)
    if (existing) {
      existing.totalCents += e.amountCents
      existing.expenses.push(e)
    } else {
      byCategory.set(e.categoryId, {
        categoryId: e.categoryId,
        categoryName: e.categoryName,
        budgetBucket: e.budgetBucket,
        totalCents: e.amountCents,
        expenses: [e],
      })
    }
  }

  const summaries = [...byCategory.values()]
    .filter((s) => filter === 'all' || s.budgetBucket === filter)
    .sort((a, b) => b.totalCents - a.totalCents)

  const totalCents = summaries.reduce((sum, s) => sum + s.totalCents, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Despesas pessoais</CardTitle>
        <AddPersonalExpenseSheet
          categories={categories}
          trigger={
            <Button size="sm" variant="outline" className="gap-1 h-8">
              <Plus className="h-3 w-3" />
              Adicionar
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {/* Filter tabs */}
        <div className="mb-4 flex gap-2 flex-wrap">
          {(['all', 'needs', 'wants', 'savings'] as Filter[]).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'Todos' : BUCKET_LABELS[f]}
            </Button>
          ))}
        </div>

        {summaries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa pessoal neste período.</p>
        ) : (
          <div className="space-y-4">
            {summaries.map((cat) => {
              const pctOfIncome = totalIncomeCents > 0
                ? Math.round((cat.totalCents / totalIncomeCents) * 100)
                : 0
              const pctOfTotal = totalCents > 0
                ? Math.round((cat.totalCents / totalCents) * 100)
                : 0
              const barColor = BUCKET_COLORS[cat.budgetBucket] ?? 'bg-gray-400'

              return (
                <div key={cat.categoryId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{cat.categoryName}</span>
                      <Badge variant={BUCKET_BADGE_VARIANT[cat.budgetBucket as keyof typeof BUCKET_BADGE_VARIANT] ?? 'secondary'} className="shrink-0 text-xs">
                        {BUCKET_LABELS[cat.budgetBucket] ?? cat.budgetBucket}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className="text-xs text-muted-foreground">{pctOfIncome}% renda</span>
                      <span className="font-medium">
                        R$ {(cat.totalCents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${pctOfTotal}%` }}
                    />
                  </div>

                  {/* Individual expense rows */}
                  <div className="pl-2 space-y-1 pt-1">
                    {cat.expenses.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{e.description ?? e.occurredAt}</span>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <span>{e.amountFormatted}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-5 w-5 text-muted-foreground hover:text-destructive"
                            disabled={deleting === e.id}
                            onClick={() => handleDelete(e.id)}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const CATEGORY_COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#a855f7',
]

function fmt(cents: number): string {
  return `R$ ${(Math.abs(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export type AllocationItem = {
  description: string | null
  occurredAt: string
  amountCents: number
  effectiveCents: number
  category: string
}

export type AllocationRow = {
  label: string
  value: number
  pctVal: number
  color: string
  items: AllocationItem[] | null
}

function useCategoryColors(items: AllocationItem[] | null): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>()
    for (const item of items ?? []) {
      if (!map.has(item.category)) {
        map.set(item.category, CATEGORY_COLORS[map.size % CATEGORY_COLORS.length]!)
      }
    }
    return map
  }, [items])
}

function AllocationModalBody({ row }: { row: AllocationRow }) {
  const [filter, setFilter] = useState<string | null>(null)
  const categoryColors = useCategoryColors(row.items)
  const categories = Array.from(categoryColors.keys())

  const items = row.items ?? []
  const visibleItems = filter ? items.filter((i) => i.category === filter) : items
  // When unfiltered, show the row's authoritative total (matches the card) rather than
  // the sum of listed items, which can drift slightly from rounding in split calculations.
  const visibleSum = filter ? visibleItems.reduce((s, i) => s + i.effectiveCents, 0) : row.value

  if (items.length === 0) {
    return (
      <>
        <div className="flex items-center justify-between text-sm border-b pb-3 mb-1">
          <span className="text-muted-foreground">Sem lançamentos</span>
          <span className="font-semibold">{row.value < 0 ? '-' : ''}{fmt(row.value)}</span>
        </div>
        <p className="text-sm text-muted-foreground py-4">
          Esse valor é o que sobra da sua renda depois das despesas e investimentos — não corresponde a lançamentos individuais.
        </p>
      </>
    )
  }

  return (
    <>
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pb-3">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
              filter === null ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground'
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => {
            const color = categoryColors.get(cat)!
            const active = filter === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(active ? null : cat)}
                className="rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors"
                style={
                  active
                    ? { backgroundColor: color, borderColor: color, color: '#fff' }
                    : { backgroundColor: `${color}1a`, borderColor: `${color}55`, color }
                }
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-sm border-b pb-3 mb-1">
        <span className="text-muted-foreground">
          {visibleItems.length} lançamento{visibleItems.length !== 1 ? 's' : ''}
        </span>
        <span className="font-semibold">{visibleSum < 0 ? '-' : ''}{fmt(visibleSum)}</span>
      </div>

      <div className="overflow-y-auto flex-1 space-y-1 pr-1">
        {visibleItems.map((item, i) => {
          const color = categoryColors.get(item.category)!
          return (
            <div
              key={i}
              className="flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{item.description ?? '—'}</p>
                <Badge
                  variant="outline"
                  className="text-xs py-0 px-1.5 mt-1"
                  style={{ backgroundColor: `${color}1a`, borderColor: `${color}55`, color }}
                >
                  {item.category}
                </Badge>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">{fmt(item.effectiveCents)}</p>
                {item.effectiveCents !== item.amountCents && (
                  <p className="text-xs text-muted-foreground line-through">{fmt(item.amountCents)}</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default function BudgetAllocationCard({ rows }: { rows: AllocationRow[] }) {
  const [selected, setSelected] = useState<AllocationRow | null>(null)

  return (
    <>
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        {selected && (
          <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{selected.label}</DialogTitle>
            </DialogHeader>
            <AllocationModalBody row={selected} />
          </DialogContent>
        )}
      </Dialog>

      <div className="space-y-3">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            onClick={() => setSelected(row)}
            className="w-full space-y-1 text-left rounded-md -mx-2 px-2 py-1 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{pct(Math.abs(row.pctVal))}</span>
                <span className="font-medium tabular-nums w-28 text-right">
                  {row.value < 0 ? '-' : ''}{fmt(row.value)}
                </span>
              </div>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${row.color} transition-all`}
                style={{ width: `${Math.min(Math.abs(row.pctVal) * 100, 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

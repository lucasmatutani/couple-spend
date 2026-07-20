'use client'

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector, type PieProps } from 'recharts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#a855f7',
]

function fmt(cents: number): string {
  return `R$ ${(Math.abs(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export type ExpenseItem = {
  description: string | null
  occurredAt: string
  amountCents: number
  effectiveCents: number
  source: 'pessoal' | 'casa'
}

export type PieSlice = {
  name: string
  value: number
  items: ExpenseItem[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
    </g>
  )
}

type TooltipProps = {
  active?: boolean
  payload?: { payload: PieSlice & { pct: number } }[]
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md pointer-events-none">
      <p className="font-medium">{d.name}</p>
      <p className="text-muted-foreground">{fmt(d.value)}</p>
      <p className="text-xs text-muted-foreground">{d.pct.toFixed(1)}% · {d.items.length} lançamento{d.items.length !== 1 ? 's' : ''}</p>
      <p className="text-xs text-primary mt-1">Clique para ver detalhes</p>
    </div>
  )
}

const SOURCE_BADGE_CLASS: Record<ExpenseItem['source'], string> = {
  casa: 'text-amber-600 border-amber-200',
  pessoal: 'text-violet-600 border-violet-200',
}

const SOURCE_CHIP_ACTIVE_CLASS: Record<ExpenseItem['source'], string> = {
  casa: 'bg-amber-500 text-white border-amber-500',
  pessoal: 'bg-violet-500 text-white border-violet-500',
}

function PieModalBody({ slice }: { slice: PieSlice }) {
  const [filter, setFilter] = useState<ExpenseItem['source'] | null>(null)
  const sources = Array.from(new Set(slice.items.map((i) => i.source)))
  const visibleItems = filter ? slice.items.filter((i) => i.source === filter) : slice.items
  const visibleSum = filter ? visibleItems.reduce((s, i) => s + i.effectiveCents, 0) : slice.value

  return (
    <>
      {sources.length > 1 && (
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
          {sources.map((source) => {
            const active = filter === source
            return (
              <button
                key={source}
                type="button"
                onClick={() => setFilter(active ? null : source)}
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                  active ? SOURCE_CHIP_ACTIVE_CLASS[source] : SOURCE_BADGE_CLASS[source]
                }`}
              >
                {source}
              </button>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-sm border-b pb-3 mb-1">
        <span className="text-muted-foreground">
          {visibleItems.length} lançamento{visibleItems.length !== 1 ? 's' : ''}
        </span>
        <span className="font-semibold">{fmt(visibleSum)}</span>
      </div>

      <div className="overflow-y-auto flex-1 space-y-1 pr-1">
        {visibleItems.map((item, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 rounded-md px-2 py-2 hover:bg-muted/40"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate">{item.description ?? '—'}</p>
              <Badge variant="outline" className={`text-xs py-0 px-1.5 mt-1 ${SOURCE_BADGE_CLASS[item.source]}`}>
                {item.source}
              </Badge>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-medium">{fmt(item.effectiveCents)}</p>
              {item.effectiveCents !== item.amountCents && (
                <p className="text-xs text-muted-foreground line-through">{fmt(item.amountCents)}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function ExpensePieChart({ data }: { data: PieSlice[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [selected, setSelected] = useState<PieSlice | null>(null)

  const total = data.reduce((s, d) => s + d.value, 0)
  const enriched = data.map((d) => ({ ...d, pct: total > 0 ? (d.value / total) * 100 : 0 }))

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum gasto neste período.
      </p>
    )
  }

  return (
    <>
      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        {selected && (
          <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[enriched.findIndex((e) => e.name === selected.name) % COLORS.length] }}
                />
                {selected.name}
              </DialogTitle>
            </DialogHeader>

            <PieModalBody slice={selected} />
          </DialogContent>
        )}
      </Dialog>

      {/* Chart + legend */}
      <div className="space-y-4">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <Pie
              {...({
                data: enriched,
                cx: '50%',
                cy: '50%',
                innerRadius: 55,
                outerRadius: 105,
                paddingAngle: 2,
                dataKey: 'value',
                activeIndex: activeIndex ?? undefined,
                activeShape: ActiveShape,
                onMouseEnter: (_: unknown, index: number) => setActiveIndex(index),
                onMouseLeave: () => setActiveIndex(null),
                onClick: (_: unknown, index: number) => setSelected(enriched[index] ?? null),
                style: { cursor: 'pointer' },
              } as PieProps)}
            >
              {enriched.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-1.5">
          {enriched.map((d, i) => (
            <button
              key={d.name}
              onClick={() => setSelected(d)}
              className="w-full flex items-center justify-between text-sm rounded-md px-2 py-1 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="truncate text-muted-foreground">{d.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {d.items.length}×
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 pl-2">
                <span className="text-xs text-muted-foreground">{d.pct.toFixed(1)}%</span>
                <span className="font-medium tabular-nums">{fmt(d.value)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

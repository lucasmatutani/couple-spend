'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ExpenseDto } from '../types'

const COLORS = [
  '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
  '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#84cc16',
  '#06b6d4', '#a855f7',
]

function fmt(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

type Props = {
  open: boolean
  onClose: () => void
  expenses: ExpenseDto[]
}

type SliceEntry = {
  name: string
  value: number
  pct: number
}

type CustomTooltipProps = {
  active?: boolean
  payload?: { payload: SliceEntry }[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  return (
    <div className="rounded-md border bg-background px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{d.name}</p>
      <p className="text-muted-foreground">{fmt(d.value)}</p>
      <p className="text-muted-foreground">{d.pct.toFixed(1)}%</p>
    </div>
  )
}

export default function HouseholdCategoryChart({ open, onClose, expenses }: Props) {
  const totals = new Map<string, number>()
  for (const e of expenses) {
    totals.set(e.categoryName, (totals.get(e.categoryName) ?? 0) + e.amountCents)
  }

  const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0)

  const data: SliceEntry[] = Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({
      name,
      value,
      pct: grandTotal > 0 ? (value / grandTotal) * 100 : 0,
    }))

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Despesas da casa por categoria</DialogTitle>
        </DialogHeader>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma despesa no período.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Total: <span className="font-semibold text-foreground">{fmt(grandTotal)}</span>
            </p>

            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value) => (
                    <span className="text-xs text-foreground">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {data.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pl-2">
                    <span className="text-muted-foreground text-xs">{d.pct.toFixed(1)}%</span>
                    <span className="font-medium tabular-nums">{fmt(d.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

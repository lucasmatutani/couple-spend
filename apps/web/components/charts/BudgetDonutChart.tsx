'use client'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

const LABELS: Record<string, string> = {
  Necessidades: 'Necessidades',
  Desejos: 'Desejos',
  Poupança: 'Poupança',
  Sobra: 'Sobra',
}

const COLORS: Record<string, string> = {
  Necessidades: '#3b82f6',
  Desejos:      '#f59e0b',
  Poupança:     '#22c55e',
  Sobra:        '#8b5cf6',
}

function fmt(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

interface Props {
  needs: number
  wants: number
  savings: number
  surplus: number
}

export function BudgetDonutChart({ needs, wants, savings, surplus }: Props) {
  const data = [
    { name: 'Necessidades', value: needs / 100 },
    { name: 'Desejos',      value: wants / 100 },
    { name: 'Poupança',     value: savings / 100 },
    { name: 'Sobra',        value: Math.max(surplus, 0) / 100 },
  ].filter((d) => d.value > 0)

  if (data.length === 0) return null

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="h-44 w-full sm:w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [fmt(value as number)]}
              contentStyle={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                color: 'hsl(var(--foreground))',
                fontSize: '0.8rem',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="flex flex-col gap-2 text-sm">
        {data.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[entry.name] }}
              />
              <span className="text-muted-foreground">{LABELS[entry.name]}</span>
            </span>
            <span className="font-medium tabular-nums">{fmt(entry.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

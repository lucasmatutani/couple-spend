'use client'
import { BarChart } from '@tremor/react'

interface Props {
  data: Array<{ month: string; total: number }>
}

export function MonthlyHistoryChart({ data }: Props) {
  const formatted = data.map((d) => ({
    month: d.month,
    'Total (R$)': d.total / 100,
  }))

  return (
    <BarChart
      data={formatted}
      index="month"
      categories={['Total (R$)']}
      colors={['violet']}
      valueFormatter={(v) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
      }
      showLegend={false}
      showGridLines={false}
      className="h-40"
    />
  )
}

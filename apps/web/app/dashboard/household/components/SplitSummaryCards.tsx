'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MemberBalanceDto } from '../types'

type Props = {
  memberBalances: MemberBalanceDto[]
  totalExpensesFormatted: string
}

export default function SplitSummaryCards({ memberBalances, totalExpensesFormatted }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberBalances.map((b) => (
          <Card key={b.userId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {b.displayName}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p
                className={`text-2xl font-bold ${
                  b.netCents >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {b.netFormatted}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pagou: {b.paidFormatted} · Deve: {b.sharedShareFormatted}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Total de despesas: <strong>{totalExpensesFormatted}</strong>
      </p>
    </div>
  )
}

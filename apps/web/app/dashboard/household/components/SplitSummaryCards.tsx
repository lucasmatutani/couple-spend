'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Money } from '@/components/ui/money'
import { StaggerList, StaggerItem } from '@/components/ui/animated'
import type { MemberBalanceDto } from '../types'

type Props = {
  memberBalances: MemberBalanceDto[]
  totalExpensesFormatted: string
}

export default function SplitSummaryCards({ memberBalances, totalExpensesFormatted }: Props) {
  return (
    <div className="space-y-3">
      <StaggerList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {memberBalances.map((b) => (
          <StaggerItem key={b.userId}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {b.displayName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Money cents={b.netCents} size="lg" colorize className="block" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Pagou: {b.paidFormatted} · Deve: {b.sharedShareFormatted}
                </p>
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </StaggerList>
      <p className="text-sm text-muted-foreground">
        Total de despesas: <strong>{totalExpensesFormatted}</strong>
      </p>
    </div>
  )
}

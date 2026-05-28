'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { markSettled } from '../actions'
import type { SettlementDto } from '../types'

type Props = {
  settlements: SettlementDto[]
  month: string
}

export default function SettlementSuggestions({ settlements, month }: Props) {
  const [pending, setPending] = useState<string | null>(null)

  async function handleSettle(s: SettlementDto) {
    const key = `${s.from}-${s.to}`
    setPending(key)
    await markSettled(s.from, s.to, s.amountCents, month)
    setPending(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Acertos sugeridos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {settlements.map((s) => {
          const key = `${s.from}-${s.to}`
          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{s.fromDisplayName}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{s.toDisplayName}</span>
                <span className="text-muted-foreground">{s.amountFormatted}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={pending === key}
                onClick={() => handleSettle(s)}
              >
                Marcar como pago
              </Button>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

'use client'

import { CreditCard, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ImportInvoiceSheet from './ImportInvoiceSheet'
import type { PersonalExpenseDto } from '../types'

type Props = {
  expenses: PersonalExpenseDto[]
  currentMonth: string
}

function fmt(cents: number): string {
  return `R$ ${(Math.abs(cents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
}

export default function CreditCardExpensesCard({ expenses, currentMonth }: Props) {
  const ccExpenses = expenses.filter((e) => e.paymentMethod === 'credit_card')

  const isRefund = (e: PersonalExpenseDto) => e.categoryName === 'Reembolsos'

  // Refunds reduce the total; purchases add to it.
  const totalCents = ccExpenses.reduce(
    (sum, e) => sum + (isRefund(e) ? -e.amountCents : e.amountCents),
    0,
  )

  // Group by category; refunds stored separately so they sort to bottom
  const byCategory = new Map<string, { name: string; signedCents: number; items: PersonalExpenseDto[] }>()
  for (const e of ccExpenses) {
    const existing = byCategory.get(e.categoryId)
    const signed = isRefund(e) ? -e.amountCents : e.amountCents
    if (existing) {
      existing.signedCents += signed
      existing.items.push(e)
    } else {
      byCategory.set(e.categoryId, { name: e.categoryName, signedCents: signed, items: [e] })
    }
  }

  // Purchases (positive) sorted desc, refunds (negative) at the bottom
  const groups = [...byCategory.values()].sort((a, b) => b.signedCents - a.signedCents)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          Cartão de crédito
          {ccExpenses.length > 0 && (
            <span className={`text-sm font-semibold ${totalCents < 0 ? 'text-green-600' : ''}`}>
              {totalCents < 0 ? '-' : ''}{fmt(totalCents)}
            </span>
          )}
        </CardTitle>
        <ImportInvoiceSheet
          currentMonth={currentMonth}
          trigger={
            <Button size="sm" variant="outline" className="gap-1 h-8 shrink-0">
              <Upload className="h-3 w-3" />
              Importar fatura
            </Button>
          }
        />
      </CardHeader>
      <CardContent>
        {ccExpenses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma despesa de cartão de crédito neste período.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const credit = group.signedCents < 0
              return (
                <div key={group.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className={`font-medium ${credit ? 'text-green-600' : ''}`}>
                      {group.name}
                    </span>
                    <span className={credit ? 'text-green-600' : 'text-muted-foreground'}>
                      {credit ? '-' : ''}{fmt(group.signedCents)}
                    </span>
                  </div>
                  <div className="pl-3 space-y-0.5">
                    {group.items.map((e) => (
                      <div key={e.id} className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{e.description ?? e.occurredAt}</span>
                        <span className={`shrink-0 ml-2 ${isRefund(e) ? 'text-green-600' : ''}`}>
                          {isRefund(e) ? '-' : ''}{fmt(e.amountCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            <div className="border-t pt-2 flex items-center justify-between text-sm font-medium">
              <span>
                {ccExpenses.length} lançamento{ccExpenses.length !== 1 ? 's' : ''}
              </span>
              <span className={totalCents < 0 ? 'text-green-600' : ''}>
                {totalCents < 0 ? '-' : ''}{fmt(totalCents)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

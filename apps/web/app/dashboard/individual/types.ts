export type IncomeDto = {
  id: string
  occurredAt: string
  amountFormatted: string
  amountCents: number
  source: string
  recurring: boolean
  recurringIncomeId: string | null
}

export type PersonalExpenseDto = {
  id: string
  occurredAt: string
  amountFormatted: string
  amountCents: number
  description: string | null
  categoryId: string
  categoryName: string
  budgetBucket: 'needs' | 'wants' | 'savings'
  recurringPersonalExpenseId: string | null
  paymentMethod: 'credit_card' | 'debit' | 'pix' | 'cash' | 'other' | null
  splitParts: number
}

export type InvestmentDto = {
  id: string
  occurredAt: string
  amountFormatted: string
  amountCents: number
  assetClass: string
  description: string | null
}

export type CategoryDto = {
  id: string
  name: string
  budgetBucket: 'needs' | 'wants' | 'savings'
}

export type RecurringPersonalExpenseDto = {
  id: string
  description: string
  amountCents: number
  amountFormatted: string
  categoryId: string
  categoryName: string
  installmentCount: number | null
}

export type BudgetSummaryDto = {
  totalIncomeFormatted: string
  totalIncomeCents: number
  totalSpentFormatted: string
  totalSpentCents: number
  totalInvestedFormatted: string
  totalInvestedCents: number
  surplusFormatted: string
  surplusCents: number
  pctSpent: number
  pctInvested: number
  /** Average surplus over the last 3 months including current, in cents */
  avgSurplus3mCents: number
  avgSurplus3mFormatted: string
}

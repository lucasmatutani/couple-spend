export type MemberBalanceDto = {
  userId: string
  displayName: string
  paidFormatted: string
  paidCents: number
  sharedShareFormatted: string
  netFormatted: string
  netCents: number
}

export type SettlementDto = {
  from: string
  fromDisplayName: string
  to: string
  toDisplayName: string
  amountFormatted: string
  amountCents: number
}

export type ExpenseDto = {
  id: string
  occurredAt: string
  description: string | null
  amountFormatted: string
  amountCents: number
  splitRuleType: string
  splitRulePayerPercent: number | null
  paidByDisplayName: string
  categoryName: string
  categoryId: string
  householdId: string
}

export type CategoryDto = {
  id: string
  name: string
  defaultSplitRule: string
}

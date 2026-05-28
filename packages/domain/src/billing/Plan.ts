export type PlanTier = 'free' | 'pro' | 'family'

export interface PlanLimits {
  maxHouseholdMembers: number
  maxImportMonthsHistory: number
  llmCategorizationEnabled: boolean
  openFinanceEnabled: boolean
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    maxHouseholdMembers: 2,
    maxImportMonthsHistory: 3,
    llmCategorizationEnabled: false,
    openFinanceEnabled: false,
  },
  pro: {
    maxHouseholdMembers: 5,
    maxImportMonthsHistory: 24,
    llmCategorizationEnabled: true,
    openFinanceEnabled: true,
  },
  family: {
    maxHouseholdMembers: 10,
    maxImportMonthsHistory: 60,
    llmCategorizationEnabled: true,
    openFinanceEnabled: true,
  },
}

export function getLimits(tier: PlanTier): PlanLimits {
  return PLAN_LIMITS[tier]
}

export function canAddMember(tier: PlanTier, currentCount: number): boolean {
  return currentCount < getLimits(tier).maxHouseholdMembers
}

/** monthsAgo = 0 means current month, 1 means last month, etc. */
export function canImportMonth(tier: PlanTier, monthsAgo: number): boolean {
  return monthsAgo <= getLimits(tier).maxImportMonthsHistory
}

import { Money } from '../kernel/Money.js'
import { type HouseholdId, type UserId } from '../kernel/ids.js'
import { type YearMonth } from '../kernel/YearMonth.js'
import { type ExpenseRepository } from '../ports/ExpenseRepository.js'
import { type HouseholdRepository } from '../ports/HouseholdRepository.js'
import { type UserRepository, type UserProfile } from '../ports/UserRepository.js'

export type MemberBalance = {
  userId: UserId
  displayName: string
  paid: Money
  sharedShare: Money
  /** Positive = others owe this member. Negative = this member owes others. */
  net: Money
}

export type Settlement = {
  from: UserId
  fromDisplayName: string
  to: UserId
  toDisplayName: string
  amount: Money
}

export type HouseholdSplitSummary = {
  householdId: HouseholdId
  month: YearMonth
  totalExpenses: Money
  memberBalances: MemberBalance[]
  settlements: Settlement[]
}

export class CalculateHouseholdSplitUseCase {
  constructor(
    private readonly householdRepo: HouseholdRepository,
    private readonly expenseRepo: ExpenseRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(householdId: HouseholdId, month: YearMonth): Promise<HouseholdSplitSummary> {
    const household = await this.householdRepo.findById(householdId)
    if (!household) throw new Error(`Household ${householdId} not found`)

    const expenses = await this.expenseRepo.findByHouseholdAndMonth(householdId, month)
    const memberCount = household.memberCount()
    const memberIds = household.members.map((m) => m.userId)

    const profiles = await this.userRepo.findManyById(memberIds)
    const profileMap = new Map<UserId, UserProfile>(profiles.map((p) => [p.id, p]))

    const paidMap = new Map<UserId, number>()
    const owedMap = new Map<UserId, number>()
    for (const id of memberIds) {
      paidMap.set(id, 0)
      owedMap.set(id, 0)
    }

    let totalCents = 0

    for (const expense of expenses) {
      totalCents += expense.amount.cents
      const payer = expense.paidBy
      paidMap.set(payer, (paidMap.get(payer) ?? 0) + expense.amount.cents)

      for (const id of memberIds) {
        const owed = expense.owedBy(id, memberCount).cents
        owedMap.set(id, (owedMap.get(id) ?? 0) + owed)
      }
    }

    const memberBalances: MemberBalance[] = memberIds.map((id) => {
      const paid = paidMap.get(id) ?? 0
      const owed = owedMap.get(id) ?? 0
      return {
        userId: id,
        displayName: profileMap.get(id)?.displayName ?? id,
        paid: Money.of(paid),
        sharedShare: Money.of(owed),
        net: Money.of(paid - owed),
      }
    })

    const settlements = this.computeSettlements(memberBalances, profileMap)

    return {
      householdId,
      month,
      totalExpenses: Money.of(totalCents),
      memberBalances,
      settlements,
    }
  }

  /**
   * Greedy minimum-transactions settlement.
   * Repeatedly pairs the largest creditor with the largest debtor until all
   * balances reach zero. Produces at most (N-1) transfers for N members.
   */
  private computeSettlements(
    balances: MemberBalance[],
    profileMap: Map<UserId, UserProfile>,
  ): Settlement[] {
    // Work with mutable cents to avoid creating many Money objects mid-loop
    const nets = balances.map((b) => ({ id: b.userId, cents: b.net.cents }))
    const settlements: Settlement[] = []

    // eslint-disable-next-line no-constant-condition
    while (true) {
      nets.sort((a, b) => b.cents - a.cents)

      const creditor = nets[0]
      const debtor = nets[nets.length - 1]

      if (!creditor || !debtor || creditor.cents <= 0 || debtor.cents >= 0) break

      const amount = Math.min(creditor.cents, -debtor.cents)
      creditor.cents -= amount
      debtor.cents += amount

      settlements.push({
        from: debtor.id,
        fromDisplayName: profileMap.get(debtor.id)?.displayName ?? debtor.id,
        to: creditor.id,
        toDisplayName: profileMap.get(creditor.id)?.displayName ?? creditor.id,
        amount: Money.of(amount),
      })
    }

    return settlements
  }
}

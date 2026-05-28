import { type HouseholdId, type UserId } from '../kernel/ids.js'
import { type Household } from '../entities/Household.js'
import { type MemberRole } from '../entities/Household.js'

export interface HouseholdRepository {
  findById(id: HouseholdId): Promise<Household | null>
  findByMember(userId: UserId): Promise<Household[]>
  findFirstByMember(userId: UserId): Promise<Household | null>
  create(name: string, createdBy: UserId): Promise<Household>
  addMember(householdId: HouseholdId, userId: UserId, role?: MemberRole): Promise<void>
}

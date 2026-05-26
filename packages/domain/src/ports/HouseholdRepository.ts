import { type HouseholdId, type UserId } from '../kernel/ids.js'
import { type Household } from '../entities/Household.js'

export interface HouseholdRepository {
  findById(id: HouseholdId): Promise<Household | null>
  findByMember(userId: UserId): Promise<Household[]>
}

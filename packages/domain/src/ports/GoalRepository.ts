import { type GoalId, type UserId } from '../kernel/ids.js'
import { type Goal } from '../entities/Goal.js'

export interface GoalRepository {
  findByOwner(ownerId: UserId): Promise<Goal[]>
  save(goal: Goal): Promise<void>
  delete(id: GoalId): Promise<void>
}

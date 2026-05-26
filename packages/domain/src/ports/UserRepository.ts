import { type UserId } from '../kernel/ids.js'

export type UserProfile = {
  id: UserId
  displayName: string
}

export interface UserRepository {
  findById(id: UserId): Promise<UserProfile | null>
  findManyById(ids: UserId[]): Promise<UserProfile[]>
}

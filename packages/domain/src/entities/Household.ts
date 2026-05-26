import { type HouseholdId, type UserId } from '../kernel/ids.js'

export type MemberRole = 'owner' | 'member'

export type HouseholdMember = {
  userId: UserId
  role: MemberRole
  joinedAt: Date
}

export class Household {
  private constructor(
    readonly id: HouseholdId,
    readonly name: string,
    readonly createdBy: UserId,
    private readonly _members: ReadonlyArray<HouseholdMember>,
    readonly createdAt: Date,
  ) {}

  static create(data: {
    id: HouseholdId
    name: string
    createdBy: UserId
    members: HouseholdMember[]
    createdAt?: Date
  }): Household {
    return new Household(
      data.id,
      data.name,
      data.createdBy,
      data.members,
      data.createdAt ?? new Date(),
    )
  }

  get members(): ReadonlyArray<HouseholdMember> {
    return this._members
  }

  memberCount(): number {
    return this._members.length
  }

  isMember(userId: UserId): boolean {
    return this._members.some((m) => m.userId === userId)
  }

  isOwner(userId: UserId): boolean {
    return this._members.some((m) => m.userId === userId && m.role === 'owner')
  }

  /** Returns a new Household with the member appended. Idempotent if already a member. */
  addMember(userId: UserId, role: MemberRole = 'member'): Household {
    if (this.isMember(userId)) return this
    const member: HouseholdMember = { userId, role, joinedAt: new Date() }
    return new Household(this.id, this.name, this.createdBy, [...this._members, member], this.createdAt)
  }
}

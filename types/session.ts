import { UserRole } from "~/utils/rbac.ts"

export interface SessionUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatar_url: string
}

export interface SessionData {
  user: SessionUser
  organizations: string[]
  teamMemberships: string[]
  role: UserRole
  expires_at: number
}

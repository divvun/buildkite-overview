export enum UserRole {
  GUEST = "guest",
  MEMBER = "member",
  ADMIN = "admin",
}

// Configuration constants
export const REQUIRED_ORGS = ["divvun", "giellalt"] as const
export const BUILD_ADMIN_TEAMS = ["divvun/Build Admins"] as const

export interface UserPermissions {
  canViewPublicPipelines: boolean
  canViewPrivatePipelines: boolean
  canCreateBuilds: boolean
  canManageAgents: boolean
  canViewQueues: boolean
  canAccessAdminFeatures: boolean
}

export function getRolePermissions(role: UserRole): UserPermissions {
  switch (role) {
    case UserRole.GUEST:
      return {
        canViewPublicPipelines: true,
        canViewPrivatePipelines: false,
        canCreateBuilds: false,
        canManageAgents: false,
        canViewQueues: false,
        canAccessAdminFeatures: false,
      }

    case UserRole.MEMBER:
      return {
        canViewPublicPipelines: true,
        canViewPrivatePipelines: true,
        canCreateBuilds: true,
        canManageAgents: false,
        canViewQueues: true,
        canAccessAdminFeatures: false,
      }

    case UserRole.ADMIN:
      return {
        canViewPublicPipelines: true,
        canViewPrivatePipelines: true,
        canCreateBuilds: true,
        canManageAgents: true,
        canViewQueues: true,
        canAccessAdminFeatures: true,
      }

    default:
      return getRolePermissions(UserRole.GUEST)
  }
}

export function hasPermission(role: UserRole, permission: keyof UserPermissions): boolean {
  const permissions = getRolePermissions(role)
  return permissions[permission]
}

export function isRoleAtLeast(userRole: UserRole, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.GUEST]: 0,
    [UserRole.MEMBER]: 1,
    [UserRole.ADMIN]: 2,
  }

  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

export function determineUserRole(organizations: string[], teamMemberships: string[] = []): UserRole {
  // Check if user is a member of required organizations
  const isMember = REQUIRED_ORGS.some((org) => organizations.includes(org))

  if (!isMember) {
    return UserRole.GUEST
  }

  // Check if user is in any of the Build Admin teams
  const isAdmin = BUILD_ADMIN_TEAMS.some((team) => teamMemberships.includes(team))

  if (isAdmin) {
    console.log(
      `✅ User is admin - found in teams: ${
        teamMemberships.filter((t) => BUILD_ADMIN_TEAMS.includes(t as any)).join(", ")
      }`,
    )
    return UserRole.ADMIN
  }

  console.log(`✅ User is member of orgs: ${organizations.filter((o) => REQUIRED_ORGS.includes(o as any)).join(", ")}`)
  return UserRole.MEMBER
}

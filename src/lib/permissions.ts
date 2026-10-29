import type { Role } from '@/types/models';

export type PermissionAction =
  | 'view'
  | 'edit'
  | 'manageMembers'
  | 'manageHousehold'
  | 'deleteHousehold';

const ALLOWED: Record<Role, readonly PermissionAction[]> = {
  owner: ['view', 'edit', 'manageMembers', 'manageHousehold', 'deleteHousehold'],
  admin: ['view', 'edit', 'manageMembers'],
  member: ['view', 'edit'],
  viewer: ['view'],
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: 'Manages the household, settings, members and permissions.',
  admin: 'Manages shared information and can invite or remove members and viewers.',
  member: 'Creates and updates shared household records.',
  viewer: 'Can view household records but cannot make changes.',
};

export function can(role: Role | undefined, action: PermissionAction): boolean {
  return role ? ALLOWED[role].includes(action) : false;
}

/** Whether `actor` may change the role of, or remove, a member whose role is `target`. */
export function canManageMember(actor: Role | undefined, target: Role): boolean {
  if (actor === 'owner') return target !== 'owner';
  if (actor === 'admin') return target === 'member' || target === 'viewer';
  return false;
}

/** Roles that `actor` may grant when inviting or changing a member. */
export function assignableRoles(actor: Role | undefined): Exclude<Role, 'owner'>[] {
  if (actor === 'owner') return ['admin', 'member', 'viewer'];
  if (actor === 'admin') return ['member', 'viewer'];
  return [];
}

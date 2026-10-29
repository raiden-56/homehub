import { describe, expect, it } from 'vitest';
import { assignableRoles, can, canManageMember } from '@/lib/permissions';

describe('permissions', () => {
  it('grants each role the documented actions', () => {
    expect(can('owner', 'deleteHousehold')).toBe(true);
    expect(can('admin', 'manageMembers')).toBe(true);
    expect(can('admin', 'manageHousehold')).toBe(false);
    expect(can('member', 'edit')).toBe(true);
    expect(can('member', 'manageMembers')).toBe(false);
    expect(can('viewer', 'view')).toBe(true);
    expect(can('viewer', 'edit')).toBe(false);
    expect(can(undefined, 'view')).toBe(false);
  });

  it('limits who can manage whom', () => {
    expect(canManageMember('owner', 'admin')).toBe(true);
    expect(canManageMember('owner', 'owner')).toBe(false);
    expect(canManageMember('admin', 'member')).toBe(true);
    expect(canManageMember('admin', 'admin')).toBe(false);
    expect(canManageMember('member', 'viewer')).toBe(false);
  });

  it('never lets anyone grant the owner role', () => {
    expect(assignableRoles('owner')).toEqual(['admin', 'member', 'viewer']);
    expect(assignableRoles('admin')).toEqual(['member', 'viewer']);
    expect(assignableRoles('member')).toEqual([]);
  });
});

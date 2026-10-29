import { describe, expect, it } from 'vitest';
import { commitChanges, switchHousehold } from '@/data/actions';
import { PermissionError } from '@/data/errors';
import { selectProfile } from '@/data/actions';
import { setupHousehold } from '@/test/utils';
import { buildAcceptance, buildInvitation, checkInvitation, invitationState } from '../invitations';
import { buildProfile } from '@/features/household/factory';
import { createProfile } from '@/data/actions';
import { newId, nowIso } from '@/lib/ids';

describe('invitations', () => {
  it('creates unpredictable, unique tokens', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => buildInvitation({ householdId: 'h', role: 'member', createdBy: 'u', hours: 24 }).token),
    );
    expect(tokens.size).toBe(50);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('rejects unknown, expired, revoked and used tokens', () => {
    const now = new Date('2026-10-29T10:00:00Z');
    const valid = buildInvitation({ householdId: 'h', role: 'member', createdBy: 'u', hours: 24, now });
    const expired = buildInvitation({ householdId: 'h', role: 'member', createdBy: 'u', hours: 1, now: new Date('2026-10-28T00:00:00Z') });
    const revoked = { ...buildInvitation({ householdId: 'h', role: 'viewer', createdBy: 'u', hours: 24, now }), status: 'revoked' as const };
    const all = [valid, expired, revoked];
    expect(checkInvitation(all, [], valid.token, 'me', now)).toMatchObject({ ok: true });
    expect(checkInvitation(all, [], 'x'.repeat(43), 'me', now)).toMatchObject({ ok: false, reason: 'not-found' });
    expect(checkInvitation(all, [], 'short', 'me', now)).toMatchObject({ ok: false, reason: 'not-found' });
    expect(checkInvitation(all, [], expired.token, 'me', now)).toMatchObject({ ok: false, reason: 'expired' });
    expect(checkInvitation(all, [], revoked.token, 'me', now)).toMatchObject({ ok: false, reason: 'revoked' });
    expect(invitationState({ ...valid, status: 'accepted' }, now)).toBe('accepted');
  });

  it('lets an invited profile join, once, and gain access to the household', async () => {
    const h = await setupHousehold();
    const invitation = buildInvitation({ householdId: h.householdId, role: 'member', createdBy: h.userId, hours: 24 });
    await h.store.dispatch(commitChanges({ put: { invitations: [invitation] } }, { action: 'manageMembers' }));

    // A different local profile opens the link.
    const guest = buildProfile('Guest', undefined, nowIso());
    await h.store.dispatch(createProfile(guest));
    await h.store.dispatch(selectProfile(guest.user.id));
    await expect(h.store.dispatch(switchHousehold(h.householdId))).rejects.toBeInstanceOf(PermissionError);

    await h.store.dispatch(
      commitChanges(buildAcceptance(invitation, guest.user.id, nowIso()), { flow: 'acceptInvitation', householdId: h.householdId }),
    );
    await h.store.dispatch(switchHousehold(h.householdId));
    expect(h.store.getState().session.activeHouseholdId).toBe(h.householdId);

    const state = h.store.getState();
    const used = state.data.invitations[invitation.id]!;
    expect(used.status).toBe('accepted');
    expect(checkInvitation(Object.values(state.data.invitations), Object.values(state.data.memberships), invitation.token, 'someone-else')).toMatchObject({
      ok: false,
      reason: 'accepted',
    });
  });
});

describe('membership rules', () => {
  it('stops members from inviting people or changing roles', async () => {
    const h = await setupHousehold({ role: 'member' });
    const invitation = buildInvitation({ householdId: h.householdId, role: 'viewer', createdBy: h.userId, hours: 24 });
    await expect(h.store.dispatch(commitChanges({ put: { invitations: [invitation] } }, { action: 'view' }))).rejects.toBeInstanceOf(PermissionError);
  });

  it('stops admins from granting admin or touching the owner', async () => {
    const h = await setupHousehold({ role: 'admin' });
    const memberId = await h.addMember('Pat', 'member');
    const state = h.store.getState();
    const patMembership = Object.values(state.data.memberships).find((membership) => membership.userId === memberId)!;
    await expect(
      h.store.dispatch(commitChanges({ put: { memberships: [{ ...patMembership, role: 'admin' }] } }, { action: 'manageMembers' })),
    ).rejects.toBeInstanceOf(PermissionError);
    await expect(
      h.store.dispatch(commitChanges({ put: { memberships: [{ ...patMembership, role: 'viewer' }] } }, { action: 'manageMembers' })),
    ).resolves.toBeUndefined();

    const ownerId = await h.addMember('Olive', 'owner');
    const ownerMembership = Object.values(h.store.getState().data.memberships).find((membership) => membership.userId === ownerId)!;
    await expect(h.store.dispatch(commitChanges({ remove: { memberships: [ownerMembership.id] } }, { action: 'manageMembers' }))).rejects.toBeInstanceOf(
      PermissionError,
    );
  });

  it('lets a member leave the household themselves', async () => {
    const h = await setupHousehold({ role: 'member' });
    const mine = Object.values(h.store.getState().data.memberships).find((membership) => membership.userId === h.userId)!;
    await expect(h.store.dispatch(commitChanges({ remove: { memberships: [mine.id] } }, { action: 'view' }))).resolves.toBeUndefined();
  });

  it('does not let a member add a fake profile to the household', async () => {
    const h = await setupHousehold({ role: 'member' });
    const now = nowIso();
    const fake = buildProfile('Mallory', undefined, now);
    await expect(
      h.store.dispatch(
        commitChanges(
          { put: { ...fake.put, memberships: [{ id: newId(), householdId: h.householdId, userId: fake.user.id, role: 'admin', createdAt: now, updatedAt: now }] } },
          { action: 'edit' },
        ),
      ),
    ).rejects.toThrow();
  });
});

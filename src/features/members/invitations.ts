import type { ChangeSet } from '@/data/collections';
import type { HouseholdInvitation, HouseholdMembership, Role } from '@/types/models';
import { newId, secureToken } from '@/lib/ids';

export const INVITE_EXPIRY_OPTIONS = [
  { hours: 24, label: '24 hours' },
  { hours: 72, label: '3 days' },
  { hours: 168, label: '7 days' },
] as const;

export type InvitationState = 'pending' | 'expired' | 'accepted' | 'revoked';

export function invitationState(invitation: HouseholdInvitation, now: Date = new Date()): InvitationState {
  if (invitation.status === 'accepted') return 'accepted';
  if (invitation.status === 'revoked') return 'revoked';
  return new Date(invitation.expiresAt).getTime() <= now.getTime() ? 'expired' : 'pending';
}

export function buildInvitation(input: {
  householdId: string;
  role: Exclude<Role, 'owner'>;
  label?: string;
  createdBy: string;
  hours: number;
  now?: Date;
}): HouseholdInvitation {
  const now = input.now ?? new Date();
  return {
    id: newId(),
    householdId: input.householdId,
    // 256 random bits from the CSPRNG — not guessable or derivable from other data.
    token: secureToken(32),
    role: input.role,
    label: input.label?.trim() || undefined,
    createdBy: input.createdBy,
    expiresAt: new Date(now.getTime() + input.hours * 3_600_000).toISOString(),
    status: 'pending',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${encodeURIComponent(token)}`;
}

export type InvitationCheck =
  | { ok: true; invitation: HouseholdInvitation }
  | { ok: false; reason: 'not-found' | 'expired' | 'revoked' | 'accepted' | 'already-member'; invitation?: HouseholdInvitation };

/** Validates a token for `userId`. Unknown, expired, revoked or used tokens are rejected. */
export function checkInvitation(
  invitations: HouseholdInvitation[],
  memberships: HouseholdMembership[],
  token: string,
  userId: string,
  now: Date = new Date(),
): InvitationCheck {
  const invitation = token.length >= 32 ? invitations.find((entry) => entry.token === token) : undefined;
  if (!invitation) return { ok: false, reason: 'not-found' };
  if (memberships.some((membership) => membership.householdId === invitation.householdId && membership.userId === userId)) {
    return { ok: false, reason: 'already-member', invitation };
  }
  const state = invitationState(invitation, now);
  if (state !== 'pending') return { ok: false, reason: state, invitation };
  return { ok: true, invitation };
}

/** Marks the invitation used and adds the membership, as one change set. */
export function buildAcceptance(invitation: HouseholdInvitation, userId: string, now: string): ChangeSet {
  const membership: HouseholdMembership = {
    id: newId(),
    householdId: invitation.householdId,
    userId,
    role: invitation.role,
    createdAt: now,
    updatedAt: now,
  };
  return {
    put: {
      invitations: [{ ...invitation, status: 'accepted', acceptedBy: userId, acceptedAt: now, updatedAt: now }],
      memberships: [membership],
    },
  };
}

import type { AppDispatch, RootState } from '@/app/store';
import { deleteHouseholdRecords, writeChanges } from '@/data/db';
import { BusinessRuleError, PermissionError } from '@/data/errors';
import { clearActiveHousehold, leaveProfile, switchHousehold } from '@/data/actions';
import { broadcastChange } from '@/data/sync';
import { changesApplied } from '@/store/dataSlice';
import { can } from '@/lib/permissions';

/**
 * Permanently deletes a household and everything in it (records, files, memberships and
 * invitations). Owner only. Afterwards another household is opened, if any.
 */
export function deleteHousehold(householdId: string) {
  return async (dispatch: AppDispatch, getState: () => RootState): Promise<'switched' | 'none'> => {
    const state = getState();
    const userId = state.session.activeUserId;
    const memberships = Object.values(state.data.memberships);
    const mine = memberships.find((membership) => membership.householdId === householdId && membership.userId === userId);
    if (!can(mine?.role, 'deleteHousehold')) throw new PermissionError('Only the household owner can delete it.');

    const removeMemberships = memberships.filter((membership) => membership.householdId === householdId).map((membership) => membership.id);
    const removeInvitations = Object.values(state.data.invitations)
      .filter((invitation) => invitation.householdId === householdId)
      .map((invitation) => invitation.id);
    await deleteHouseholdRecords(householdId);
    const changes = { remove: { households: [householdId], memberships: removeMemberships, invitations: removeInvitations } };
    await writeChanges(changes);
    if (getState().session.activeHouseholdId === householdId) await dispatch(clearActiveHousehold());
    dispatch(changesApplied(changes));
    broadcastChange({ kind: 'global' });

    const next = memberships.find((membership) => membership.userId === userId && membership.householdId !== householdId);
    if (next) {
      await dispatch(switchHousehold(next.householdId));
      return 'switched';
    }
    return 'none';
  };
}

/**
 * Deletes the active local profile. Refused while the profile owns a household, so shared data is
 * never orphaned; the owner must delete those households first.
 */
export function deleteProfile() {
  return async (dispatch: AppDispatch, getState: () => RootState): Promise<void> => {
    const state = getState();
    const userId = state.session.activeUserId;
    if (!userId) throw new PermissionError('Choose a profile first.');
    const memberships = Object.values(state.data.memberships).filter((membership) => membership.userId === userId);
    if (memberships.some((membership) => membership.role === 'owner')) {
      throw new BusinessRuleError('You own a household. Delete it in Settings → Household first, then delete your profile.');
    }
    const changes = {
      remove: { users: [userId], preferences: [userId], memberships: memberships.map((membership) => membership.id) },
    };
    await writeChanges(changes);
    await dispatch(leaveProfile());
    dispatch(changesApplied(changes));
    broadcastChange({ kind: 'global' });
  };
}

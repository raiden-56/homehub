import type { AppDispatch, RootState } from '@/app/store';
import {
  GLOBAL_COLLECTIONS,
  isHouseholdCollection,
  type ChangeSet,
  type CollectionName,
} from './collections';
import { getMeta, loadGlobal, loadHousehold, setMeta, writeChanges, type WriteOptions } from './db';
import { BusinessRuleError, PermissionError, TenantIsolationError } from './errors';
import { broadcastChange } from './sync';
import { assignableRoles, can, canManageMember, type PermissionAction } from '@/lib/permissions';
import { newId, nowIso } from '@/lib/ids';
import {
  booted,
  bootFailed,
  householdFailed,
  householdLoading,
  householdReady,
  householdUnset,
  userSelected,
} from '@/store/sessionSlice';
import { changesApplied, globalLoaded, householdCleared, householdLoaded } from '@/store/dataSlice';
import type { ActivityEntity, ActivityLog, Role } from '@/types/models';

type Thunk<R = void> = (dispatch: AppDispatch, getState: () => RootState) => Promise<R>;

const META_ACTIVE_USER = 'activeUserId';
const metaActiveHousehold = (userId: string) => `activeHousehold:${userId}`;

function membershipFor(state: RootState, userId: string | null, householdId: string | null) {
  if (!userId || !householdId) return undefined;
  return Object.values(state.data.memberships).find(
    (membership) => membership.userId === userId && membership.householdId === householdId,
  );
}

/** Loads profiles and restores the previous profile + household selection. */
export function bootstrap(): Thunk {
  return async (dispatch, getState) => {
    try {
      dispatch(globalLoaded(await loadGlobal()));
      const userId = await getMeta<string>(META_ACTIVE_USER);
      if (userId && getState().data.users[userId]) {
        dispatch(userSelected(userId));
        await dispatch(restoreHousehold(userId));
      }
      dispatch(booted());
    } catch {
      dispatch(bootFailed('HomeHub could not open its local database. Check that this browser allows site storage.'));
    }
  };
}

function restoreHousehold(userId: string): Thunk {
  return async (dispatch, getState) => {
    const saved = await getMeta<string>(metaActiveHousehold(userId));
    const state = getState();
    const fallback = Object.values(state.data.memberships).find((membership) => membership.userId === userId);
    const householdId = saved && membershipFor(state, userId, saved) ? saved : fallback?.householdId;
    if (householdId) await dispatch(switchHousehold(householdId));
  };
}

/** Selects which local profile is using the app. Local mode has no passwords. */
export function selectProfile(userId: string): Thunk {
  return async (dispatch, getState) => {
    if (!getState().data.users[userId]) throw new BusinessRuleError('That profile no longer exists.');
    await setMeta(META_ACTIVE_USER, userId);
    dispatch(householdCleared());
    dispatch(userSelected(userId));
    await dispatch(restoreHousehold(userId));
  };
}

export function leaveProfile(): Thunk {
  return async (dispatch) => {
    await setMeta(META_ACTIVE_USER, null);
    dispatch(householdCleared());
    dispatch(userSelected(null));
  };
}

/**
 * Makes `householdId` the active household. Only households the active profile belongs to
 * can be opened; household data from the previous selection is discarded first.
 */
export function switchHousehold(householdId: string): Thunk {
  return async (dispatch, getState) => {
    const { activeUserId } = getState().session;
    if (!membershipFor(getState(), activeUserId, householdId)) {
      throw new PermissionError('You are not a member of that household.');
    }
    dispatch(householdCleared());
    dispatch(householdLoading(householdId));
    try {
      const snapshot = await loadHousehold(householdId);
      // Ignore stale responses if the user switched again while loading.
      if (getState().session.activeHouseholdId !== householdId) return;
      dispatch(householdLoaded(snapshot));
      dispatch(householdReady());
      if (activeUserId) await setMeta(metaActiveHousehold(activeUserId), householdId);
    } catch {
      dispatch(householdFailed('Household data could not be loaded.'));
    }
  };
}

export function reloadGlobal(): Thunk {
  return async (dispatch) => {
    dispatch(globalLoaded(await loadGlobal()));
  };
}

/** Re-reads the active household (e.g. after another tab changed it). */
export function reloadHousehold(): Thunk {
  return async (dispatch, getState) => {
    const { activeHouseholdId } = getState().session;
    if (!activeHouseholdId) return;
    try {
      const snapshot = await loadHousehold(activeHouseholdId);
      if (getState().session.activeHouseholdId !== activeHouseholdId) return;
      dispatch(householdLoaded(snapshot));
      dispatch(householdReady());
    } catch {
      dispatch(householdFailed('Household data could not be loaded.'));
    }
  };
}

export interface ActivityInput {
  entity: ActivityEntity;
  entityId?: string;
  message: string;
}

export interface CommitOptions {
  /** Permission the acting member needs. Defaults to `edit`. */
  action?: PermissionAction;
  /** Rejects the write if this key was already used (prevents duplicate financial/inventory records). */
  idempotencyKey?: string;
  activity?: ActivityInput | ActivityInput[];
  blobs?: WriteOptions['blobs'];
  /**
   * Special flows that run before the actor has a role in the target household. The caller must
   * already have validated the request (e.g. the invitation token).
   */
  flow?: 'createHousehold' | 'acceptInvitation';
  /** Target household for `flow`; defaults to the active household. */
  householdId?: string;
}

function recordsOf(changes: ChangeSet, name: CollectionName): { id: string; [key: string]: unknown }[] {
  return (changes.put?.[name] ?? []) as unknown as { id: string; [key: string]: unknown }[];
}

function assertTenant(state: RootState, changes: ChangeSet, householdId: string, options: CommitOptions) {
  const userId = state.session.activeUserId;
  const fail = () => {
    throw new TenantIsolationError('This change refers to data outside the current household and was blocked.');
  };
  for (const name of Object.keys(changes.put ?? {}) as CollectionName[]) {
    for (const record of recordsOf(changes, name)) {
      if (isHouseholdCollection(name)) {
        if (record.householdId !== householdId) fail();
        continue;
      }
      switch (name) {
        case 'households':
          if (record.id !== householdId) fail();
          break;
        case 'memberships':
        case 'invitations':
          if (record.householdId !== householdId) fail();
          if (options.flow === 'acceptInvitation' && name === 'memberships' && record.userId !== userId) fail();
          break;
        case 'users':
        case 'preferences': {
          // Members may only edit their own profile. Owners/admins (and the household creator)
          // may additionally create brand-new local profiles for people they add.
          const isNew = !state.data[name][record.id];
          const mayCreate = options.flow === 'createHousehold' || options.action === 'manageMembers';
          if (record.id !== userId && !(isNew && mayCreate)) fail();
          break;
        }
      }
    }
  }
  for (const [name, ids] of Object.entries(changes.remove ?? {}) as [CollectionName, string[]][]) {
    const table = state.data[name] as Record<string, { householdId?: string; id: string; userId?: string }>;
    for (const id of ids) {
      const existing = table[id];
      if (!existing) continue;
      if (name === 'households' ? existing.id !== householdId : existing.householdId !== undefined && existing.householdId !== householdId) {
        fail();
      }
      if ((name === 'users' || name === 'preferences') && id !== userId) fail();
    }
  }
}

/**
 * Membership and invitation changes need member-management rights, except a member leaving
 * the household themselves. Nobody can change or remove the owner's membership, and admins can
 * only manage members and viewers.
 */
function assertMembershipRules(state: RootState, changes: ChangeSet, userId: string, role: Role | undefined) {
  const deny = (message: string) => {
    throw new PermissionError(message);
  };
  const isSelf = (membership: { userId?: unknown }) => membership.userId === userId;

  for (const record of recordsOf(changes, 'memberships')) {
    const existing = state.data.memberships[record.id];
    if (existing?.role === 'owner' && record.role !== 'owner') deny('The owner’s role can’t be changed.');
    if (existing && isSelf(existing) && record.role === existing.role) continue;
    if (!can(role, 'manageMembers')) deny('Only owners and admins can manage members.');
    if (existing && !canManageMember(role, existing.role)) deny('Your role can’t change this member.');
    if (record.role === 'owner' && !existing) deny('New members can’t be added as owner.');
    if (record.role !== 'owner' && !assignableRoles(role).includes(record.role as Exclude<Role, 'owner'>)) {
      deny('Your role can’t grant that permission level.');
    }
  }
  for (const id of changes.remove?.memberships ?? []) {
    const existing = state.data.memberships[id];
    if (!existing) continue;
    if (existing.role === 'owner') deny('The owner can’t be removed from the household.');
    if (isSelf(existing)) continue;
    if (!can(role, 'manageMembers') || !canManageMember(role, existing.role)) deny('Your role can’t remove this member.');
  }
  if ((changes.put?.invitations?.length || changes.remove?.invitations?.length) && !can(role, 'manageMembers')) {
    deny('Only owners and admins can manage invitations.');
  }
  for (const invitation of changes.put?.invitations ?? []) {
    if (!assignableRoles(role).includes(invitation.role)) deny('Your role can’t invite people with that permission level.');
  }
}

/**
 * The single write path for the app. Checks the acting member's role and tenant ownership,
 * writes atomically to IndexedDB, then updates the store and notifies other tabs.
 */
export function commitChanges(changes: ChangeSet, options: CommitOptions = {}): Thunk {
  return async (dispatch, getState) => {
    const state = getState();
    const userId = state.session.activeUserId;
    if (!userId) throw new PermissionError('Choose a profile before making changes.');
    const householdId = options.householdId ?? state.session.activeHouseholdId;
    if (!householdId) throw new PermissionError('Choose a household before making changes.');

    if (options.flow === 'createHousehold') {
      if (state.data.households[householdId]) throw new BusinessRuleError('That household already exists.');
    } else if (options.flow === 'acceptInvitation') {
      const invitation = recordsOf(changes, 'invitations')[0];
      if (!invitation || invitation.householdId !== householdId || invitation.acceptedBy !== userId) {
        throw new PermissionError('That invitation is not valid for this profile.');
      }
    } else {
      const role = membershipFor(state, userId, householdId)?.role;
      if (!can(role, options.action ?? 'edit')) {
        throw new PermissionError(
          role === 'viewer'
            ? 'Viewers can see household records but cannot make changes.'
            : 'Your role in this household does not allow that change.',
        );
      }
    }

    assertTenant(state, changes, householdId, options);
    if (!options.flow) assertMembershipRules(state, changes, userId, membershipFor(state, userId, householdId)?.role);

    const activities = options.activity ? [options.activity].flat() : [];
    const now = nowIso();
    const activityRecords: ActivityLog[] = activities.map((entry) => ({
      id: newId(),
      householdId,
      actorId: userId,
      entity: entry.entity,
      entityId: entry.entityId,
      message: entry.message,
      createdAt: now,
      updatedAt: now,
    }));
    const finalChanges: ChangeSet = activityRecords.length
      ? { ...changes, put: { ...changes.put, activity: [...(changes.put?.activity ?? []), ...activityRecords] } }
      : changes;

    await writeChanges(finalChanges, {
      idempotencyKey: options.idempotencyKey ? `${householdId}:${options.idempotencyKey}` : undefined,
      householdId,
      blobs: options.blobs,
    });

    const touchesActive = householdId === state.session.activeHouseholdId;
    const visible: ChangeSet = touchesActive
      ? finalChanges
      : {
          put: Object.fromEntries(
            Object.entries(finalChanges.put ?? {}).filter(([name]) => !isHouseholdCollection(name as CollectionName)),
          ),
          remove: Object.fromEntries(
            Object.entries(finalChanges.remove ?? {}).filter(([name]) => !isHouseholdCollection(name as CollectionName)),
          ),
        };
    dispatch(changesApplied(visible));

    const touchesGlobal = GLOBAL_COLLECTIONS.some((name) => finalChanges.put?.[name] || finalChanges.remove?.[name]);
    if (touchesGlobal) broadcastChange({ kind: 'global' });
    broadcastChange({ kind: 'household', householdId });
  };
}

/** Writes a brand-new local profile. Profiles are not password protected in local mode. */
export function createProfile(changes: ChangeSet): Thunk {
  return async (dispatch) => {
    const users = changes.put?.users ?? [];
    if (users.length !== 1) throw new BusinessRuleError('Create one profile at a time.');
    await writeChanges(changes);
    dispatch(changesApplied(changes));
    broadcastChange({ kind: 'global' });
  };
}

/** Leaves the active household view (e.g. after deleting or leaving it). */
export function clearActiveHousehold(): Thunk {
  return async (dispatch, getState) => {
    const { activeUserId } = getState().session;
    dispatch(householdCleared());
    dispatch(householdUnset());
    if (activeUserId) await setMeta(metaActiveHousehold(activeUserId), null);
  };
}

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';
import type { CollectionName, Collections } from '@/data/collections';
import type { Household, Role, User } from '@/types/models';
import { DEFAULT_TIME_ZONE } from '@/lib/dates';

type ListSelector<K extends CollectionName> = (state: RootState) => Collections[K][];

const listSelectorCache = new Map<CollectionName, ListSelector<CollectionName>>();

/** Memoized array of every record in a collection (household collections hold only the active household). */
export function selectList<K extends CollectionName>(name: K): ListSelector<K> {
  let selector = listSelectorCache.get(name);
  if (!selector) {
    selector = createSelector(
      (state: RootState) => state.data[name],
      (table) => Object.values(table),
    ) as ListSelector<CollectionName>;
    listSelectorCache.set(name, selector);
  }
  return selector as unknown as ListSelector<K>;
}

export const selectActiveUserId = (state: RootState) => state.session.activeUserId;
export const selectActiveHouseholdId = (state: RootState) => state.session.activeHouseholdId;

export const selectCurrentUser = (state: RootState): User | undefined =>
  state.session.activeUserId ? state.data.users[state.session.activeUserId] : undefined;

export const selectActiveHousehold = (state: RootState): Household | undefined =>
  state.session.activeHouseholdId ? state.data.households[state.session.activeHouseholdId] : undefined;

export const selectHouseholdTimeZone = (state: RootState): string =>
  selectActiveHousehold(state)?.timeZone ?? DEFAULT_TIME_ZONE;

export const selectCurrency = (state: RootState): string => selectActiveHousehold(state)?.currency ?? 'INR';

export const selectActiveRole = createSelector(
  [selectList('memberships'), selectActiveUserId, selectActiveHouseholdId],
  (memberships, userId, householdId): Role | undefined =>
    memberships.find((membership) => membership.userId === userId && membership.householdId === householdId)
      ?.role,
);

export interface MemberInfo {
  userId: string;
  membershipId: string;
  name: string;
  email?: string;
  avatarColor: string;
  role: Role;
  joinedAt: string;
}

/** Members of the active household, owner first, then alphabetically. */
export const selectMembers = createSelector(
  [selectList('memberships'), (state: RootState) => state.data.users, selectActiveHouseholdId],
  (memberships, users, householdId): MemberInfo[] => {
    const roleOrder: Record<Role, number> = { owner: 0, admin: 1, member: 2, viewer: 3 };
    return memberships
      .filter((membership) => membership.householdId === householdId)
      .flatMap((membership) => {
        const user = users[membership.userId];
        if (!user) return [];
        return [
          {
            userId: user.id,
            membershipId: membership.id,
            name: user.name,
            email: user.email,
            avatarColor: user.avatarColor,
            role: membership.role,
            joinedAt: membership.createdAt,
          },
        ];
      })
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.name.localeCompare(b.name));
  },
);

/** Households the active user belongs to. */
export const selectMyHouseholds = createSelector(
  [selectList('memberships'), (state: RootState) => state.data.households, selectActiveUserId],
  (memberships, households, userId) =>
    memberships
      .filter((membership) => membership.userId === userId)
      .flatMap((membership) => {
        const household = households[membership.householdId];
        return household ? [{ household, role: membership.role }] : [];
      })
      .sort((a, b) => a.household.name.localeCompare(b.household.name)),
);

export const selectCurrentPreferences = (state: RootState) =>
  state.session.activeUserId ? state.data.preferences[state.session.activeUserId] : undefined;

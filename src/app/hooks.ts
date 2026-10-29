import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';
import type { ChangeSet, CollectionName, Collections } from '@/data/collections';
import { commitChanges, type CommitOptions } from '@/data/actions';
import { toUserMessage } from '@/data/errors';
import { can, type PermissionAction } from '@/lib/permissions';
import { hourIn, todayIn } from '@/lib/dates';
import {
  selectActiveHousehold,
  selectActiveRole,
  selectCurrency,
  selectCurrentUser,
  selectHouseholdTimeZone,
  selectList,
  selectMembers,
} from '@/store/selectors';
import { useToast } from '@/components/feedback/ToastProvider';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/** Every record in a collection (household collections contain only the active household). */
export function useCollection<K extends CollectionName>(name: K): Collections[K][] {
  return useAppSelector(selectList(name));
}

export function useRecord<K extends CollectionName>(name: K, id: string | undefined): Collections[K] | undefined {
  return useAppSelector((state) => (id ? (state.data[name] as Record<string, Collections[K]>)[id] : undefined));
}

export function useActiveHousehold() {
  return useAppSelector(selectActiveHousehold);
}

export function useCurrentUser() {
  return useAppSelector(selectCurrentUser);
}

export function useMembers() {
  return useAppSelector(selectMembers);
}

/**
 * `true` while the active household's records are being read from storage. Pages show their
 * own skeletons during this time instead of an empty state.
 */
export function useHouseholdLoading(): boolean {
  return useAppSelector((state) => state.session.householdStatus === 'loading' || state.session.householdStatus === 'idle');
}

export function useCurrency() {
  return useAppSelector(selectCurrency);
}

export function useRole() {
  return useAppSelector(selectActiveRole);
}

/** Whether the active member may perform `action` in the active household. */
export function useCan(action: PermissionAction = 'edit'): boolean {
  return can(useRole(), action);
}

function useTick(intervalMs: number): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return tick;
}

/** Today's date (`YYYY-MM-DD`) in the household time zone; refreshes each minute. */
export function useToday(): string {
  const timeZone = useAppSelector(selectHouseholdTimeZone);
  const tick = useTick(60_000);
  return todayIn(timeZone, new Date(tick));
}

export function useHouseholdHour(): number {
  const timeZone = useAppSelector(selectHouseholdTimeZone);
  const tick = useTick(60_000);
  return hourIn(timeZone, new Date(tick));
}

export interface CommitRequest extends CommitOptions {
  /** Toast shown on success. Omit for silent updates (e.g. ticking a checkbox). */
  success?: string;
  /** Change set that reverses this commit; when present the success toast offers Undo. */
  undo?: ChangeSet;
}

/**
 * Returns a function that commits a change set and reports the outcome to the user.
 * Resolves to `true` when the change was saved.
 */
export function useCommit() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  return useCallback(
    async (changes: ChangeSet, request: CommitRequest = {}): Promise<boolean> => {
      const { success, undo, ...options } = request;
      try {
        await dispatch(commitChanges(changes, options));
      } catch (error) {
        toast.show({ message: toUserMessage(error), severity: 'error' });
        return false;
      }
      if (success) {
        toast.show({
          message: success,
          severity: 'success',
          action: undo
            ? {
                label: 'Undo',
                onClick: () => {
                  dispatch(commitChanges(undo, { action: options.action })).then(
                    () => toast.show({ message: 'Change undone', severity: 'info' }),
                    (error: unknown) => toast.show({ message: toUserMessage(error), severity: 'error' }),
                  );
                },
              }
            : undefined,
        });
      }
      return true;
    },
    [dispatch, toast],
  );
}

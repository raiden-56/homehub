import { useCallback, useMemo } from 'react';
import { useActiveHousehold, useAppSelector, useCommit, useCurrentUser, useRole, useToday } from '@/app/hooks';
import { selectCurrentPreferences } from '@/store/selectors';
import { defaultPreferences } from '@/features/household/factory';
import { nowIso } from '@/lib/ids';
import type { NotificationState } from '@/types/models';
import { deriveNotifications, type AppNotification } from './derive';

export interface NotificationView extends AppNotification {
  read: boolean;
}

/** Derived notifications for the active member, with persisted read / dismissed state. */
export function useNotifications() {
  const data = useAppSelector((state) => state.data);
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const role = useRole();
  const today = useToday();
  const storedPreferences = useAppSelector(selectCurrentPreferences);
  const commit = useCommit();

  const notifications = useMemo((): NotificationView[] => {
    if (!user || !household) return [];
    const preferences = (storedPreferences ?? defaultPreferences(user.id, '')).notifications;
    const states = data.notificationStates;
    return deriveNotifications({
      data,
      today,
      userId: user.id,
      role,
      preferences,
      enabledModules: household.enabledModules,
    })
      .map((notification) => {
        const state = states[`${user.id}:${notification.key}`];
        return { ...notification, read: !!state?.readAt, dismissed: !!state?.dismissedAt };
      })
      .filter((notification) => !notification.dismissed)
      .map(({ dismissed: _dismissed, ...notification }) => notification);
  }, [data, household, user, role, today, storedPreferences]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const update = useCallback(
    async (keys: string[], patch: Partial<Pick<NotificationState, 'readAt' | 'dismissedAt'>>) => {
      if (!user || !household || keys.length === 0) return;
      const now = nowIso();
      const records: NotificationState[] = keys.map((key) => {
        const id = `${user.id}:${key}`;
        const existing = data.notificationStates[id];
        return {
          id,
          householdId: household.id,
          userId: user.id,
          key,
          readAt: existing?.readAt,
          dismissedAt: existing?.dismissedAt,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          ...patch,
        };
      });
      // Read state is personal, so viewers may update it too.
      await commit({ put: { notificationStates: records } }, { action: 'view' });
    },
    [user, household, data.notificationStates, commit],
  );

  const markRead = useCallback((keys: string[]) => update(keys, { readAt: nowIso() }), [update]);
  const dismiss = useCallback((key: string) => update([key], { dismissedAt: nowIso(), readAt: nowIso() }), [update]);

  return { notifications, unreadCount, markRead, dismiss };
}

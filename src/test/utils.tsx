import type { ReactElement, ReactNode } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { MotionConfig } from 'framer-motion';
import { createAppStore, type AppStore } from '@/app/store';
import { createAppTheme } from '@/theme/theme';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { ConfirmProvider } from '@/components/feedback/ConfirmProvider';
import { writeChanges } from '@/data/db';
import { changesApplied } from '@/store/dataSlice';
import { householdLoading, householdReady, userSelected, booted } from '@/store/sessionSlice';
import type { ChangeSet } from '@/data/collections';
import { buildNewHousehold, buildProfile } from '@/features/household/factory';
import type { Role } from '@/types/models';
import { newId } from '@/lib/ids';

export interface TestHousehold {
  store: AppStore;
  userId: string;
  householdId: string;
  categoryIds: string[];
  locationIds: string[];
  /** Adds another member to the household and returns their user id. */
  addMember: (name: string, role: Role) => Promise<string>;
  /** Persists and applies extra records (bypassing permission checks — test setup only). */
  seed: (changes: ChangeSet) => Promise<void>;
}

/**
 * Creates a store with one profile who owns one household, persisted to (fake) IndexedDB so
 * thunks that write through the data layer behave exactly as in the app.
 */
export async function setupHousehold(options: { role?: Role; name?: string } = {}): Promise<TestHousehold> {
  const store = createAppStore();
  const now = new Date().toISOString();
  const profile = buildProfile(options.name ?? 'Test Owner', undefined, now);
  const { household, changes, taxonomy } = buildNewHousehold(
    { name: 'Test Home', type: 'family', currency: 'INR', timeZone: 'Asia/Kolkata' },
    profile.user.id,
    now,
  );
  if (options.role && options.role !== 'owner') {
    const membership = changes.put!.memberships![0]!;
    membership.role = options.role;
  }
  const all: ChangeSet = { put: { ...profile.put, ...changes.put } };
  await writeChanges(all);
  store.dispatch(changesApplied(all));
  store.dispatch(booted());
  store.dispatch(userSelected(profile.user.id));
  store.dispatch(householdLoading(household.id));
  store.dispatch(householdReady());

  const seed = async (extra: ChangeSet) => {
    await writeChanges(extra);
    store.dispatch(changesApplied(extra));
  };

  return {
    store,
    userId: profile.user.id,
    householdId: household.id,
    categoryIds: taxonomy.categories.map((category) => category.id),
    locationIds: taxonomy.locations.map((location) => location.id),
    seed,
    addMember: async (name, role) => {
      const member = buildProfile(name, undefined, now);
      await seed({
        put: {
          ...member.put,
          memberships: [{ id: newId(), householdId: household.id, userId: member.user.id, role, createdAt: now, updatedAt: now }],
        },
      });
      return member.user.id;
    },
  };
}

function Providers({ store, children }: { store: AppStore; children: ReactNode }) {
  return (
    <Provider store={store}>
      <ThemeProvider theme={createAppTheme('light')}>
        <CssBaseline />
        <MotionConfig reducedMotion="always">
          <ToastProvider>
            <ConfirmProvider>{children}</ConfirmProvider>
          </ToastProvider>
        </MotionConfig>
      </ThemeProvider>
    </Provider>
  );
}

/**
 * Renders `ui` with the app providers. Pass `route` + `path` to render inside a router at a
 * given URL (e.g. `path: '/inventory/*'`, `route: '/inventory?stock=low'`).
 */
export function renderWithProviders(
  ui: ReactElement,
  { store, route = '/', path }: { store: AppStore; route?: string; path?: string },
) {
  return render(
    <Providers store={store}>
      <MemoryRouter initialEntries={[route]}>
        {path ? (
          <Routes>
            <Route path={path} element={ui} />
          </Routes>
        ) : (
          ui
        )}
      </MemoryRouter>
    </Providers>,
  );
}

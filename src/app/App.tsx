import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Box, CircularProgress } from '@mui/material';
import { store } from './store';
import { router } from './router';
import { useAppDispatch, useAppSelector } from './hooks';
import { AppThemeProvider } from './AppThemeProvider';
import { bootstrap, reloadGlobal, reloadHousehold } from '@/data/actions';
import { subscribeToChanges } from '@/data/sync';
import { ToastProvider } from '@/components/feedback/ToastProvider';
import { ConfirmProvider } from '@/components/feedback/ConfirmProvider';
import { ErrorState } from '@/components/ui/ErrorState';

/** Loads local data once, and reloads when another tab in this browser changes it. */
function Boot() {
  const dispatch = useAppDispatch();
  const bootStatus = useAppSelector((state) => state.session.bootStatus);
  const error = useAppSelector((state) => state.session.error);
  const activeHouseholdId = useAppSelector((state) => state.session.activeHouseholdId);

  useEffect(() => {
    dispatch(bootstrap());
  }, [dispatch]);

  useEffect(
    () =>
      subscribeToChanges((message) => {
        if (message.kind === 'global') dispatch(reloadGlobal());
        else if (message.householdId === activeHouseholdId) dispatch(reloadHousehold());
      }),
    [dispatch, activeHouseholdId],
  );

  if (bootStatus === 'booting') {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading HomeHub">
        <CircularProgress size={28} />
      </Box>
    );
  }
  if (bootStatus === 'error') {
    return (
      <Box component="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <ErrorState
          title="HomeHub couldn’t start"
          description={error ?? undefined}
          onRetry={() => window.location.reload()}
        />
      </Box>
    );
  }
  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <Provider store={store}>
      <AppThemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <Boot />
          </ConfirmProvider>
        </ToastProvider>
      </AppThemeProvider>
    </Provider>
  );
}

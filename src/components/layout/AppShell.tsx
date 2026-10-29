import { Suspense, useEffect, useState } from 'react';
import { Box, Link, useMediaQuery, useTheme } from '@mui/material';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav, MOBILE_NAV_HEIGHT } from './MobileNav';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { reloadHousehold } from '@/data/actions';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageSkeleton } from '@/components/ui/Skeletons';
import { PageTransition } from '@/components/ui/motion';
import { RouteErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { QuickAddHost } from '@/features/quickAdd/QuickAddHost';
import { GlobalSearchDialog } from '@/features/search/GlobalSearchDialog';
import { useRecurrenceMaintenance } from '@/features/recurrence/useRecurrenceMaintenance';

export function AppShell() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const isWide = useMediaQuery(theme.breakpoints.up('lg'));
  const [collapsed, setCollapsed] = useState(!isWide);
  const { pathname } = useLocation();
  const householdStatus = useAppSelector((state) => state.session.householdStatus);
  const dispatch = useAppDispatch();

  // Tablets start with a collapsed sidebar; wide screens start expanded.
  useEffect(() => setCollapsed(!isWide), [isWide]);

  // Keep recurring bills generated for the upcoming window.
  useRecurrenceMaintenance();

  // Page transitions run when the top-level section changes, not on every sub-route or filter change.
  const section = pathname.split('/')[1] ?? '';

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default' }}>
      <Link
        href="#main-content"
        sx={{
          position: 'absolute',
          left: 8,
          top: -48,
          zIndex: 2000,
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          px: 2,
          py: 1,
          borderRadius: 2,
          '&:focus': { top: 8 },
        }}
      >
        Skip to content
      </Link>
      {isDesktop && <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar />
        <Box
          component="main"
          id="main-content"
          tabIndex={-1}
          sx={{
            flex: 1,
            width: '100%',
            maxWidth: 1440,
            mx: 'auto',
            px: { xs: 2, sm: 3, lg: 4 },
            pt: { xs: 2.5, md: 3.5 },
            pb: { xs: `calc(${MOBILE_NAV_HEIGHT + 24}px + env(safe-area-inset-bottom))`, md: 6 },
            outline: 'none',
          }}
        >
          {householdStatus === 'error' ? (
            <ErrorState
              title="Household data couldn’t be loaded"
              description="HomeHub couldn’t read this household from browser storage. Nothing has been deleted."
              onRetry={() => dispatch(reloadHousehold())}
            />
          ) : (
            <RouteErrorBoundary resetKey={pathname}>
              <Suspense fallback={<PageSkeleton />}>
                <AnimatePresence mode="wait" initial={false}>
                  <PageTransition key={section}>
                    <Outlet />
                  </PageTransition>
                </AnimatePresence>
              </Suspense>
            </RouteErrorBoundary>
          )}
        </Box>
      </Box>
      {!isDesktop && <MobileNav />}
      <QuickAddHost />
      <GlobalSearchDialog />
    </Box>
  );
}

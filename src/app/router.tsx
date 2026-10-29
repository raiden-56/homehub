import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAppSelector } from './hooks';
import { paths } from './paths';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorState } from '@/components/ui/ErrorState';

const WelcomePage = lazy(() => import('@/features/profile/WelcomePage'));
const OnboardingPage = lazy(() => import('@/features/onboarding/OnboardingPage'));
const InvitePage = lazy(() => import('@/features/members/InvitePage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const InventoryModule = lazy(() => import('@/features/inventory/InventoryModule'));
const ShoppingModule = lazy(() => import('@/features/shopping/ShoppingModule'));
const TasksModule = lazy(() => import('@/features/tasks/TasksModule'));
const FinanceModule = lazy(() => import('@/features/finance/FinanceModule'));
const MaintenanceModule = lazy(() => import('@/features/maintenance/MaintenanceModule'));
const CalendarModule = lazy(() => import('@/features/calendar/CalendarModule'));
const DocumentsModule = lazy(() => import('@/features/documents/DocumentsModule'));
const MembersPage = lazy(() => import('@/features/members/MembersPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading HomeHub">
      <CircularProgress size={28} />
    </Box>
  );
}

function Standalone({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>;
}

/** Routes below require a chosen local profile. */
function RequireProfile() {
  const userId = useAppSelector((state) => state.session.activeUserId);
  const location = useLocation();
  if (!userId) {
    const next = location.pathname === '/' ? '' : `?next=${encodeURIComponent(location.pathname + location.search)}`;
    return <Navigate to={`${paths.welcome()}${next}`} replace />;
  }
  return <Outlet />;
}

/** Routes below require an active household the profile belongs to. */
function RequireHousehold() {
  const householdId = useAppSelector((state) => state.session.activeHouseholdId);
  if (!householdId) return <Navigate to={paths.onboarding()} replace />;
  return <AppShell />;
}

function NotFoundPage() {
  return <ErrorState kind="not-found" title="Page not found" description="That page doesn’t exist in HomeHub." />;
}

export const router = createBrowserRouter([
  { path: '/welcome', element: <Standalone><WelcomePage /></Standalone> },
  {
    element: <RequireProfile />,
    children: [
      { path: '/onboarding', element: <Standalone><OnboardingPage /></Standalone> },
      { path: '/invite/:token', element: <Standalone><InvitePage /></Standalone> },
      {
        element: <RequireHousehold />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'inventory/*', element: <InventoryModule /> },
          { path: 'shopping/*', element: <ShoppingModule /> },
          { path: 'tasks/*', element: <TasksModule /> },
          { path: 'finance/*', element: <FinanceModule /> },
          { path: 'maintenance/*', element: <MaintenanceModule /> },
          { path: 'calendar/*', element: <CalendarModule /> },
          { path: 'documents/*', element: <DocumentsModule /> },
          { path: 'members', element: <MembersPage /> },
          { path: 'settings/:section?', element: <SettingsPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);

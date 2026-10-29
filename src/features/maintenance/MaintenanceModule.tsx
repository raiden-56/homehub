import { Button } from '@mui/material';
import { Link as RouterLink, Route, Routes } from 'react-router-dom';
import { paths } from '@/app/paths';
import { ErrorState } from '@/components/ui/ErrorState';
import SchedulePage from './SchedulePage';
import AssetsPage from './AssetsPage';
import AssetDetailPage from './AssetDetailPage';

/**
 * Routes under `/maintenance/*`: the schedule (with a task drawer at `tasks/:taskId`), the asset
 * list, and individual asset pages.
 */
export default function MaintenanceModule() {
  return (
    <Routes>
      <Route index element={<SchedulePage />} />
      <Route path="tasks/:taskId" element={<SchedulePage />} />
      <Route path="assets" element={<AssetsPage />} />
      <Route path="assets/:assetId" element={<AssetDetailPage />} />
      <Route
        path="*"
        element={
          <ErrorState
            kind="not-found"
            title="Page not found"
            action={
              <Button component={RouterLink} to={paths.maintenance()}>
                Go to maintenance
              </Button>
            }
          />
        }
      />
    </Routes>
  );
}

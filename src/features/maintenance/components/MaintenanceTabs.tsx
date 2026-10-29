import { Box, Tab, Tabs } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { paths } from '@/app/paths';

export function MaintenanceTabs({ value }: { value: 'schedule' | 'assets' }) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Tabs value={value} aria-label="Maintenance sections">
        <Tab value="schedule" label="Schedule" component={RouterLink} to={paths.maintenance()} />
        <Tab value="assets" label="Assets & warranties" component={RouterLink} to={paths.assets()} />
      </Tabs>
    </Box>
  );
}

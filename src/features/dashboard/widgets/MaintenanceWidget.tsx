import { useMemo } from 'react';
import { Box, Link } from '@mui/material';
import { Wrench } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCollection, useToday } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { selectCurrentPreferences } from '@/store/selectors';
import {
  DEFAULT_MAINTENANCE_LEAD_DAYS,
  MAINTENANCE_STATUS_LABELS,
  maintenanceDueStatus,
  type MaintenanceDueStatus,
} from '@/features/maintenance/logic';
import { addDaysISO, relativeDay } from '@/lib/dates';
import { paths } from '@/app/paths';
import { WidgetFooterLink, WidgetRow, rowLinkSx } from './WidgetList';

const TONE: Partial<Record<MaintenanceDueStatus, StatusTone>> = { overdue: 'danger', 'due-soon': 'warning', scheduled: 'neutral' };

export function MaintenanceWidget() {
  const tasks = useCollection('maintenanceTasks');
  const assets = useAppSelector((state) => state.data.assets);
  const leadDays = useAppSelector(selectCurrentPreferences)?.notifications.maintenanceLeadDays ?? DEFAULT_MAINTENANCE_LEAD_DAYS;
  const today = useToday();

  const upcoming = useMemo(() => {
    const horizon = addDaysISO(today, 45);
    return tasks
      .filter((task) => task.status === 'scheduled' && task.dueDate <= horizon)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, today]);

  return (
    <SectionCard title="Maintenance schedule" subtitle="Next 45 days" icon={<Wrench size={17} />} sx={{ height: '100%' }}>
      {upcoming.length === 0 ? (
        <EmptyState compact icon={<Wrench size={20} />} title="No maintenance scheduled" description="Service visits and upkeep for your appliances will appear here." />
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Upcoming maintenance">
          {upcoming.slice(0, 5).map((task) => {
            const status = maintenanceDueStatus(task, today, leadDays);
            const asset = task.assetId ? assets[task.assetId] : undefined;
            return (
              <Box component="li" key={task.id}>
                <WidgetRow
                  title={
                    <Link component={RouterLink} to={paths.maintenanceTask(task.id)} sx={rowLinkSx}>
                      {task.name}
                    </Link>
                  }
                  subtitle={[asset?.name, `${status === 'overdue' ? 'Was due' : 'Due'} ${relativeDay(task.dueDate, today).toLowerCase()}`, task.provider]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <>
                      <StatusChip tone={TONE[status] ?? 'neutral'} label={MAINTENANCE_STATUS_LABELS[status]} />
                      <MemberAvatar userId={task.assigneeId} size={26} />
                    </>
                  }
                />
              </Box>
            );
          })}
        </Box>
      )}
      <WidgetFooterLink to={paths.maintenance({ due: 'upcoming' })}>Open maintenance</WidgetFooterLink>
    </SectionCard>
  );
}

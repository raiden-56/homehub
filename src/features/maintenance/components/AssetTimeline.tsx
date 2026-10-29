import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { CalendarClock, CircleCheck, ShieldAlert, ShieldCheck, ShoppingBag, SkipForward, type LucideIcon } from 'lucide-react';
import { useToday } from '@/app/hooks';
import { Money } from '@/components/ui/Money';
import { formatDate, relativeDay } from '@/lib/dates';
import type { Asset, MaintenanceRecord, MaintenanceTask, Minor } from '@/types/models';

interface TimelineEvent {
  key: string;
  date: string;
  icon: LucideIcon;
  tone: 'primary' | 'success' | 'warning' | 'neutral';
  title: string;
  detail?: string;
  cost?: Minor;
  upcoming: boolean;
  onOpen?: () => void;
}

interface AssetTimelineProps {
  asset: Asset;
  tasks: MaintenanceTask[];
  records: MaintenanceRecord[];
  onOpenTask: (taskId: string) => void;
}

/** Chronological history of an asset: purchase, services, scheduled work and warranty end. */
export function AssetTimeline({ asset, tasks, records, onOpenTask }: AssetTimelineProps) {
  const today = useToday();
  const events: TimelineEvent[] = [];
  if (asset.purchaseDate) {
    events.push({
      key: 'purchase',
      date: asset.purchaseDate,
      icon: ShoppingBag,
      tone: 'neutral',
      title: 'Purchased',
      detail: [asset.manufacturer, asset.model].filter(Boolean).join(' ') || undefined,
      cost: asset.purchasePriceMinor,
      upcoming: false,
    });
  }
  if (asset.warrantyExpiry) {
    const ended = asset.warrantyExpiry < today;
    events.push({
      key: 'warranty',
      date: asset.warrantyExpiry,
      icon: ended ? ShieldAlert : ShieldCheck,
      tone: ended ? 'neutral' : 'warning',
      title: ended ? 'Warranty ended' : 'Warranty ends',
      upcoming: !ended,
    });
  }
  for (const record of records) {
    events.push({
      key: `record-${record.id}`,
      date: record.completedDate,
      icon: CircleCheck,
      tone: 'success',
      title: record.workPerformed,
      detail: record.provider,
      cost: record.actualCostMinor,
      upcoming: false,
      onOpen: record.maintenanceTaskId ? () => onOpenTask(record.maintenanceTaskId!) : undefined,
    });
  }
  for (const task of tasks) {
    if (task.status === 'completed') continue;
    const cancelled = task.status === 'cancelled';
    events.push({
      key: `task-${task.id}`,
      date: task.dueDate,
      icon: cancelled ? SkipForward : CalendarClock,
      tone: cancelled ? 'neutral' : 'primary',
      title: cancelled ? `Skipped: ${task.name}` : task.name,
      detail: cancelled ? undefined : `Scheduled · ${relativeDay(task.dueDate, today).toLowerCase()}`,
      upcoming: !cancelled && task.dueDate >= today,
      onOpen: () => onOpenTask(task.id),
    });
  }
  events.sort((a, b) => b.date.localeCompare(a.date));

  if (events.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nothing recorded yet. Add a purchase date, schedule maintenance or log past work to build this asset’s history.
      </Typography>
    );
  }

  return (
    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Asset timeline">
      {events.map((event, index) => {
        const Icon = event.icon;
        const body = (
          <Stack direction="row" spacing={1.5} sx={{ width: '100%', textAlign: 'left' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                aria-hidden
                sx={(theme) => {
                  const colours = {
                    primary: [theme.tokens.sage, theme.tokens.sageText],
                    success: [theme.tokens.successSoft, theme.tokens.successText],
                    warning: [theme.tokens.amberSoft, theme.tokens.amberText],
                    neutral: [theme.tokens.neutralSoft, theme.tokens.textSecondary],
                  }[event.tone];
                  return {
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    backgroundColor: colours[0],
                    color: colours[1],
                  };
                }}
              >
                <Icon size={15} />
              </Box>
              {index < events.length - 1 && <Box aria-hidden sx={{ width: 2, flex: 1, minHeight: 16, bgcolor: 'divider', my: 0.5 }} />}
            </Box>
            <Box sx={{ pb: 2, minWidth: 0, flex: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {formatDate(event.date, 'd MMM yyyy')}
                {event.upcoming ? ' · upcoming' : ''}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {event.title}
              </Typography>
              {(event.detail || event.cost !== undefined) && (
                <Typography variant="caption" color="text.secondary" component="p">
                  {event.detail}
                  {event.detail && event.cost !== undefined ? ' · ' : ''}
                  {event.cost !== undefined && <Money minor={event.cost} />}
                </Typography>
              )}
            </Box>
          </Stack>
        );
        return (
          <Box component="li" key={event.key}>
            {event.onOpen ? (
              <ButtonBase
                onClick={event.onOpen}
                sx={{ width: '100%', borderRadius: 2, '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main' } }}
              >
                {body}
              </ButtonBase>
            ) : (
              body
            )}
          </Box>
        );
      })}
    </Box>
  );
}

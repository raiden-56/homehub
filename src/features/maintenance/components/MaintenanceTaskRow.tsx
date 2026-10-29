import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { Repeat } from 'lucide-react';
import { useRecord, useToday } from '@/app/hooks';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatDate, relativeDay } from '@/lib/dates';
import type { MaintenanceTask } from '@/types/models';
import { MAINTENANCE_STATUS_LABELS, maintenanceDueStatus } from '../logic';
import { MAINTENANCE_STATUS_TONES, useLeadDays } from '../ui';

interface MaintenanceTaskRowProps {
  task: MaintenanceTask;
  onOpen: () => void;
  /** Hide the asset name (e.g. on the asset's own page). */
  hideAsset?: boolean;
}

export function MaintenanceTaskRow({ task, onOpen, hideAsset }: MaintenanceTaskRowProps) {
  const today = useToday();
  const leadDays = useLeadDays();
  const asset = useRecord('assets', task.assetId);
  const record = useRecord('maintenanceRecords', task.recordId);
  const status = maintenanceDueStatus(task, today, leadDays.maintenance);
  const done = status === 'completed' || status === 'cancelled';
  const dateText = done
    ? status === 'completed'
      ? `Done ${formatDate(record?.completedDate ?? task.updatedAt.slice(0, 10), 'd MMM yyyy')}`
      : `Skipped · was due ${formatDate(task.dueDate, 'd MMM')}`
    : `Due ${relativeDay(task.dueDate, today).toLowerCase()} · ${formatDate(task.dueDate, 'EEE d MMM')}`;
  const cost = status === 'completed' ? record?.actualCostMinor : task.estimatedCostMinor;

  return (
    <Box component="li" sx={{ borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
      <ButtonBase
        onClick={onOpen}
        aria-label={`${task.name}, ${MAINTENANCE_STATUS_LABELS[status]}`}
        sx={{
          width: '100%',
          px: 2,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          textAlign: 'left',
          justifyContent: 'flex-start',
          transition: 'background-color 140ms ease',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography
              sx={{ fontWeight: 600, textDecoration: status === 'cancelled' ? 'line-through' : undefined }}
              color={done ? 'text.secondary' : 'text.primary'}
              noWrap
            >
              {task.name}
            </Typography>
            {task.recurrence && (
              <Box component="span" sx={{ color: 'text.secondary', display: 'inline-flex' }} title="Repeats">
                <Repeat size={14} aria-label="Repeats" />
              </Box>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" noWrap>
            {[hideAsset ? undefined : asset?.name, dateText, task.provider].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        {cost !== undefined && (
          <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
            {status === 'completed' ? '' : 'est. '}
            <Money minor={cost} />
          </Typography>
        )}
        <StatusChip tone={MAINTENANCE_STATUS_TONES[status]} label={MAINTENANCE_STATUS_LABELS[status]} />
        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
          <MemberAvatar userId={task.assigneeId} size={28} />
        </Box>
      </ButtonBase>
    </Box>
  );
}

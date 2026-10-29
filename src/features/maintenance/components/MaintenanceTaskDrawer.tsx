import { useState } from 'react';
import { Alert, Box, Button, Divider, Link, Stack, Typography } from '@mui/material';
import { CheckCircle2, Pencil, SkipForward, Trash2, XCircle } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCan, useCollection, useCommit, useRecord, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { DetailDrawer, DetailRow } from '@/components/ui/DetailDrawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { Money } from '@/components/ui/Money';
import { StatusChip } from '@/components/ui/StatusChip';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { formatDate, relativeDay } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrence';
import { nowIso } from '@/lib/ids';
import { LinkedDocuments } from '@/features/documents/components/LinkedDocuments';
import { sameLink } from '@/features/documents/logic';
import { MAINTENANCE_STATUS_LABELS, buildSkipMaintenance, maintenanceDueStatus } from '../logic';
import { MAINTENANCE_STATUS_TONES, PRIORITY_LABELS, PRIORITY_TONES, useLeadDays } from '../ui';
import { CompleteMaintenanceDialog } from './CompleteMaintenanceDialog';
import { MaintenanceTaskDialog } from './MaintenanceTaskDialog';

export function MaintenanceTaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const task = useRecord('maintenanceTasks', taskId);
  const asset = useRecord('assets', task?.assetId);
  const record = useRecord('maintenanceRecords', task?.recordId);
  const allTasks = useCollection('maintenanceTasks');
  const documents = useCollection('documents');
  const data = useAppSelector((state) => state.data);
  const today = useToday();
  const leadDays = useLeadDays();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  if (!task) {
    return (
      <DetailDrawer open onClose={onClose} title="Maintenance task">
        <ErrorState kind="not-found" title="Maintenance task not found" />
      </DetailDrawer>
    );
  }

  const status = maintenanceDueStatus(task, today, leadDays.maintenance);
  const open = status !== 'completed' && status !== 'cancelled';

  const skip = async () => {
    const recurring = !!task.recurrence;
    const ok = await confirm({
      title: recurring ? 'Skip this occurrence?' : 'Cancel this maintenance?',
      description: recurring
        ? 'It will be marked as skipped and the next occurrence will be scheduled.'
        : 'It will be marked as cancelled and kept in the history.',
      confirmLabel: recurring ? 'Skip' : 'Cancel maintenance',
      cancelLabel: 'Keep',
    });
    if (!ok) return;
    await commit(buildSkipMaintenance(task, new Set(allTasks.map((entry) => entry.id)), nowIso()), {
      activity: { entity: 'maintenance', entityId: task.id, message: `${recurring ? 'Skipped' : 'Cancelled'} maintenance “${task.name}”` },
      success: recurring ? 'Occurrence skipped' : 'Maintenance cancelled',
    });
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${task.name}”?`,
      description: record
        ? 'The task is removed. Its completed maintenance record (and any expense) stays in the asset history.'
        : 'The scheduled task is removed permanently. Linked documents are kept.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    const now = nowIso();
    const link = { type: 'maintenance' as const, id: task.id };
    const unlinked = documents
      .filter((document) => document.links.some((entry) => sameLink(entry, link)))
      .map((document) => ({ ...document, links: document.links.filter((entry) => !sameLink(entry, link)), updatedAt: now }));
    const records = Object.values(data.maintenanceRecords)
      .filter((entry) => entry.maintenanceTaskId === task.id)
      .map((entry) => ({ ...entry, maintenanceTaskId: undefined, updatedAt: now }));
    onClose();
    await commit(
      {
        put: { ...(unlinked.length ? { documents: unlinked } : {}), ...(records.length ? { maintenanceRecords: records } : {}) },
        remove: { maintenanceTasks: [task.id] },
      },
      { activity: { entity: 'maintenance', entityId: task.id, message: `Deleted maintenance “${task.name}”` }, success: 'Maintenance deleted' },
    );
  };

  return (
    <DetailDrawer
      open
      onClose={onClose}
      title={task.name}
      subtitle={
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.75, mt: 0.5 }}>
          <StatusChip tone={MAINTENANCE_STATUS_TONES[status]} label={MAINTENANCE_STATUS_LABELS[status]} />
          <StatusChip tone={PRIORITY_TONES[task.priority]} label={PRIORITY_LABELS[task.priority]} />
        </Stack>
      }
    >
      <Stack spacing={2.5}>
        {canEdit && open && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Button variant="contained" startIcon={<CheckCircle2 size={16} />} onClick={() => setCompleteOpen(true)}>
              Mark complete
            </Button>
            <Button variant="outlined" startIcon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button color="inherit" startIcon={task.recurrence ? <SkipForward size={16} /> : <XCircle size={16} />} onClick={skip}>
              {task.recurrence ? 'Skip this time' : 'Cancel'}
            </Button>
          </Stack>
        )}
        {!canEdit && <Alert severity="info">Viewers can see maintenance but can’t change it.</Alert>}

        <Box>
          <DetailRow label="Asset">
            {asset ? (
              <Link component={RouterLink} to={paths.asset(asset.id)} underline="hover">
                {asset.name}
              </Link>
            ) : (
              'No specific asset'
            )}
          </DetailRow>
          <DetailRow label="Due">
            {formatDate(task.dueDate, 'EEE d MMM yyyy')}
            {open && ` (${relativeDay(task.dueDate, today).toLowerCase()})`}
          </DetailRow>
          <DetailRow label="Repeats">{describeRecurrence(task.recurrence)}</DetailRow>
          <DetailRow label="Assigned to">
            <MemberAvatar userId={task.assigneeId} withName size={22} />
          </DetailRow>
          <DetailRow label="Service provider">{task.provider ?? '—'}</DetailRow>
          <DetailRow label="Estimated cost">
            <Money minor={task.estimatedCostMinor} fallback="Not set" />
          </DetailRow>
          {task.description && <DetailRow label="Description">{task.description}</DetailRow>}
          {task.notes && <DetailRow label="Notes">{task.notes}</DetailRow>}
        </Box>

        {record && (
          <Box sx={(theme) => ({ p: 2, borderRadius: 3, backgroundColor: theme.tokens.successSoft })}>
            <Typography variant="h4" component="h3" sx={{ mb: 1 }}>
              Completed {formatDate(record.completedDate, 'd MMM yyyy')}
            </Typography>
            <Typography variant="body2">{record.workPerformed}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {record.provider && `${record.provider} · `}
              {record.actualCostMinor !== undefined ? (
                <>
                  Actual cost <Money minor={record.actualCostMinor} />
                </>
              ) : (
                'No cost recorded'
              )}
            </Typography>
            {record.expenseId && (
              <Link component={RouterLink} to={paths.expense(record.expenseId)} underline="hover" variant="body2">
                View expense
              </Link>
            )}
            {record.notes && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {record.notes}
              </Typography>
            )}
          </Box>
        )}

        <Divider />
        <LinkedDocuments link={{ type: 'maintenance', id: task.id }} title="Documents" />

        {canEdit && (
          <>
            <Divider />
            <Box>
              <Button color="error" startIcon={<Trash2 size={16} />} onClick={remove}>
                Delete task
              </Button>
            </Box>
          </>
        )}
      </Stack>
      {canEdit && (
        <>
          <MaintenanceTaskDialog open={editOpen} onClose={() => setEditOpen(false)} task={task} />
          <CompleteMaintenanceDialog open={completeOpen} onClose={() => setCompleteOpen(false)} task={task} />
        </>
      )}
    </DetailDrawer>
  );
}

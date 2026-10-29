import { useMemo, useState } from 'react';
import { Box, Button, Card, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import { AlertCircle, CalendarClock, Plus, Wallet, Wrench } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan, useCollection, useHouseholdLoading, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { TaskListSkeleton } from '@/components/ui/Skeletons';
import type { MaintenanceTask } from '@/types/models';
import {
  SCHEDULE_GROUP_LABELS,
  lifetimeMaintenanceCost,
  maintenanceDueStatus,
  scheduleGroup,
  type ScheduleGroup,
} from './logic';
import { useLeadDays } from './ui';
import { MaintenanceTabs } from './components/MaintenanceTabs';
import { MaintenanceTaskRow } from './components/MaintenanceTaskRow';
import { MaintenanceTaskDialog } from './components/MaintenanceTaskDialog';
import { MaintenanceTaskDrawer } from './components/MaintenanceTaskDrawer';

type DueFilter = '' | 'upcoming' | 'overdue' | 'completed';
const GROUP_ORDER: ScheduleGroup[] = ['overdue', 'due-soon', 'scheduled', 'done'];
const RECENT_DONE = 10;

function MiniStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; tone: 'danger' | 'warning' | 'primary' }) {
  return (
    <Card sx={{ p: 2, flex: 1, minWidth: 0 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          aria-hidden
          sx={(theme) => {
            const colours = {
              danger: [theme.tokens.errorSoft, theme.tokens.errorText],
              warning: [theme.tokens.amberSoft, theme.tokens.amberText],
              primary: [theme.tokens.sage, theme.tokens.sageText],
            }[tone];
            return { width: 36, height: 36, borderRadius: 2.5, display: 'grid', placeItems: 'center', backgroundColor: colours[0], color: colours[1], flexShrink: 0 };
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h3" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Stack>
    </Card>
  );
}

export default function SchedulePage() {
  const tasks = useCollection('maintenanceTasks');
  const records = useCollection('maintenanceRecords');
  const assets = useCollection('assets');
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const today = useToday();
  const leadDays = useLeadDays();
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);

  const dueParam = searchParams.get('due');
  const due: DueFilter = dueParam === 'upcoming' || dueParam === 'overdue' || dueParam === 'completed' ? dueParam : '';
  const q = searchParams.get('q') ?? '';

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const assetNames = useMemo(() => new Map(assets.map((asset) => [asset.id, asset.name])), [assets]);

  const groups = useMemo(() => {
    const query = q.trim().toLowerCase();
    const map = new Map<ScheduleGroup, MaintenanceTask[]>();
    for (const task of tasks) {
      if (query) {
        const haystack = [task.name, task.provider, task.description, task.assetId ? assetNames.get(task.assetId) : ''].join(' ').toLowerCase();
        if (!haystack.includes(query)) continue;
      }
      const group = scheduleGroup(maintenanceDueStatus(task, today, leadDays.maintenance));
      if (due === 'upcoming' && group === 'done') continue;
      if (due === 'overdue' && group !== 'overdue') continue;
      if (due === 'completed' && group !== 'done') continue;
      map.set(group, [...(map.get(group) ?? []), task]);
    }
    return GROUP_ORDER.flatMap((key): { key: ScheduleGroup; tasks: MaintenanceTask[]; total: number }[] => {
      const list = map.get(key);
      if (!list) return [];
      if (key === 'done') {
        list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return [{ key, tasks: due === 'completed' ? list : list.slice(0, RECENT_DONE), total: list.length }];
      }
      list.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.name.localeCompare(b.name));
      return [{ key, tasks: list, total: list.length }];
    });
  }, [tasks, q, due, today, leadDays.maintenance, assetNames]);

  const counts = useMemo(() => {
    let overdue = 0;
    let soon = 0;
    for (const task of tasks) {
      const status = maintenanceDueStatus(task, today, leadDays.maintenance);
      if (status === 'overdue') overdue += 1;
      if (status === 'due-soon') soon += 1;
    }
    const thisYear = records.filter((record) => record.completedDate.slice(0, 4) === today.slice(0, 4));
    return { overdue, soon, spend: lifetimeMaintenanceCost(thisYear) };
  }, [tasks, records, today, leadDays.maintenance]);

  const addButton = (
    <Tooltip title={canEdit ? '' : 'Viewers can’t schedule maintenance'}>
      <span>
        <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setDialogOpen(true)} disabled={!canEdit}>
          Schedule maintenance
        </Button>
      </span>
    </Tooltip>
  );

  const openTask = (id: string) => navigate({ pathname: paths.maintenanceTask(id), search: searchParams.toString() });
  const closeTask = () => navigate({ pathname: paths.maintenance(), search: searchParams.toString() });

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Keep appliances in good shape — service schedules, history and warranties in one place."
        actions={addButton}
      >
        <MaintenanceTabs value="schedule" />
      </PageHeader>

      {!loading && tasks.length > 0 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2.5 }}>
          <MiniStat icon={<AlertCircle size={18} />} tone="danger" value={counts.overdue} label="Overdue" />
          <MiniStat icon={<CalendarClock size={18} />} tone="warning" value={counts.soon} label={`Due in the next ${leadDays.maintenance} days`} />
          <MiniStat
            icon={<Wallet size={18} />}
            tone="primary"
            value={counts.spend.costedCount > 0 ? <Money minor={counts.spend.totalMinor} /> : '—'}
            label={counts.spend.costedCount > 0 ? 'Spent on maintenance this year' : 'No costs recorded this year'}
          />
        </Stack>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
        <SearchField value={q} onChange={(value) => setParam('q', value)} placeholder="Search maintenance" sx={{ maxWidth: { md: 320 } }} />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={due}
          onChange={(_, value: DueFilter | null) => setParam('due', value ?? '')}
          aria-label="Filter by status"
          sx={{ flexWrap: 'wrap' }}
        >
          <ToggleButton value="">All</ToggleButton>
          <ToggleButton value="upcoming">Upcoming</ToggleButton>
          <ToggleButton value="overdue">Overdue</ToggleButton>
          <ToggleButton value="completed">History</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {loading ? (
        <Card>
          <TaskListSkeleton />
        </Card>
      ) : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Wrench size={24} />}
            title="No maintenance scheduled"
            description="Schedule services like AC cleaning or filter changes, and HomeHub will remind you when they’re due."
            action={canEdit ? addButton : undefined}
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={<Wrench size={20} />}
            title={due === 'overdue' ? 'Nothing overdue' : 'No maintenance matches'}
            description={due === 'overdue' ? 'All maintenance is on schedule.' : 'Try a different search or filter.'}
            action={<Button onClick={() => setSearchParams({}, { replace: true })}>Show everything</Button>}
          />
        </Card>
      ) : (
        <Stack spacing={2}>
          {groups.map((group) => (
            <Card key={group.key} component="section" aria-labelledby={`group-${group.key}`}>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ px: 2, pt: 1.75, pb: 1 }}>
                <Typography id={`group-${group.key}`} variant="h3" component="h2">
                  {SCHEDULE_GROUP_LABELS[group.key]}
                  <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    {group.total}
                  </Typography>
                </Typography>
                {group.key === 'done' && group.total > group.tasks.length && (
                  <Button size="small" onClick={() => setParam('due', 'completed')}>
                    View all history
                  </Button>
                )}
              </Stack>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, borderTop: 1, borderColor: 'divider' }}>
                {group.tasks.map((task) => (
                  <MaintenanceTaskRow key={task.id} task={task} onOpen={() => openTask(task.id)} />
                ))}
              </Box>
            </Card>
          ))}
        </Stack>
      )}

      <MaintenanceTaskDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      {taskId && !loading && <MaintenanceTaskDrawer taskId={taskId} onClose={closeTask} />}
    </>
  );
}

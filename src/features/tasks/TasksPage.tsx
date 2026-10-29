import { useMemo, useState } from 'react';
import { Box, Button, Card, Chip, Stack, Tab, Tabs, Tooltip } from '@mui/material';
import { CalendarDays, CheckSquare, Columns3, List, Plus, Users } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCan, useCollection, useCurrentUser, useHouseholdLoading, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { CalendarSkeleton, TaskListSkeleton } from '@/components/ui/Skeletons';
import type { Task } from '@/types/models';
import { filterTasks, isTaskOverdue, sortTasks } from './logic';
import { useTaskFilters, type TaskView } from './useTaskFilters';
import { TaskFiltersBar } from './components/TaskFiltersBar';
import { TaskList } from './components/TaskList';
import { TaskBoard } from './components/TaskBoard';
import { TaskCalendarView } from './components/TaskCalendarView';
import { WorkloadView } from './components/WorkloadView';
import { TaskDialog } from './components/TaskDialog';
import { TaskDetailDrawer } from './components/TaskDetailDrawer';
import { DeleteTaskDialog } from './components/DeleteTaskDialog';

const VIEW_TABS: { value: TaskView; label: string; icon: React.ReactElement }[] = [
  { value: 'list', label: 'List', icon: <List size={16} /> },
  { value: 'board', label: 'Board', icon: <Columns3 size={16} /> },
  { value: 'calendar', label: 'Calendar', icon: <CalendarDays size={16} /> },
  { value: 'workload', label: 'Workload', icon: <Users size={16} /> },
];

type DialogState = { mode: 'create'; defaults?: { dueDate?: string; assigneeId?: string } } | { mode: 'edit'; task: Task } | null;

export default function TasksPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const today = useToday();
  const user = useCurrentUser();
  const canEdit = useCan('edit');
  const loading = useHouseholdLoading();
  const tasks = useCollection('tasks');
  const { filters, view: explicitView, sort, update, clear, activeFilterCount } = useTaskFilters();
  const view: TaskView = explicitView ?? 'list';
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const search = location.search;
  const linkForId = (id: string) => `${paths.task(id)}${search}`;
  const linkFor = (task: Task) => linkForId(task.id);

  // The board and calendar show every status, so the status filter only applies to the list.
  const visible = useMemo(() => {
    const effective = view === 'list' ? filters : { ...filters, status: 'all' as const };
    return sortTasks(filterTasks(tasks, effective, today, user?.id), sort);
  }, [tasks, filters, view, sort, today, user?.id]);

  // Keep the board focused: completed tasks older than two weeks are left out.
  const boardTasks = useMemo(() => {
    const cutoff = new Date(Date.now() - 14 * 86_400_000).toISOString();
    return visible.filter((task) => task.status !== 'completed' || (task.completedAt ?? '') >= cutoff);
  }, [visible]);

  const counts = useMemo(() => {
    const open = tasks.filter((task) => task.status !== 'completed');
    return {
      open: open.length,
      overdue: open.filter((task) => isTaskOverdue(task, today)).length,
      today: open.filter((task) => task.dueDate === today).length,
    };
  }, [tasks, today]);

  const create = (defaults?: { dueDate?: string; assigneeId?: string }) => setDialog({ mode: 'create', defaults });

  const renderEmpty = () => {
    if (tasks.length === 0) {
      return (
        <EmptyState
          icon={<CheckSquare size={24} />}
          title="No tasks yet"
          description="Add chores and to-dos, assign them to someone, and set them to repeat so nothing slips."
          action={
            canEdit ? (
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => create()}>
                Create a task
              </Button>
            ) : undefined
          }
        />
      );
    }
    if (filters.due === 'today' && activeFilterCount === 1 && !filters.q) {
      return <EmptyState icon={<CheckSquare size={24} />} title="Nothing due today" description="Enjoy the breathing room — or get ahead on something from later this week." />;
    }
    return (
      <EmptyState
        icon={<CheckSquare size={24} />}
        title={filters.status === 'overdue' ? 'Nothing overdue' : 'No tasks match these filters'}
        description={filters.status === 'overdue' ? 'Every task is on track.' : 'Try clearing a filter or searching for something else.'}
        action={
          activeFilterCount > 0 || filters.q ? (
            <Button variant="outlined" onClick={clear}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  };

  const renderContent = () => {
    if (loading) return view === 'calendar' ? <CalendarSkeleton /> : <Card><TaskListSkeleton /></Card>;
    if (view === 'workload') return <WorkloadView tasks={tasks} today={today} />;
    if (view === 'calendar') {
      return <TaskCalendarView tasks={visible} today={today} linkFor={linkForId} onAdd={canEdit ? (date) => create({ dueDate: date }) : undefined} />;
    }
    if (view === 'board') {
      return tasks.length === 0 ? (
        <Card>{renderEmpty()}</Card>
      ) : (
        <TaskBoard tasks={boardTasks} today={today} canEdit={canEdit} linkFor={linkFor} onEdit={(task) => setDialog({ mode: 'edit', task })} onDelete={setDeleting} />
      );
    }
    return visible.length === 0 ? (
      <Card>{renderEmpty()}</Card>
    ) : (
      <TaskList
        tasks={visible}
        sort={sort}
        today={today}
        canEdit={canEdit}
        linkFor={linkFor}
        onEdit={(task) => setDialog({ mode: 'edit', task })}
        onDelete={setDeleting}
      />
    );
  };

  return (
    <>
      <PageHeader
        title="Chores & Tasks"
        description="Who’s doing what, and when. Repeating chores schedule themselves when completed."
        actions={
          <Tooltip title={canEdit ? '' : 'Viewers can’t create tasks'}>
            <span>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => create()} disabled={!canEdit}>
                New task
              </Button>
            </span>
          </Tooltip>
        }
      >
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip
            label={`${counts.open} open`}
            onClick={() => update({ status: null, due: null, view: null })}
            variant={filters.status === 'open' && !filters.due ? 'filled' : 'outlined'}
            color={filters.status === 'open' && !filters.due ? 'primary' : 'default'}
          />
          <Chip
            label={`${counts.overdue} overdue`}
            onClick={() => update({ status: 'overdue', due: null, view: null })}
            variant={filters.status === 'overdue' ? 'filled' : 'outlined'}
            color={filters.status === 'overdue' ? 'primary' : 'default'}
          />
          <Chip
            label={`${counts.today} due today`}
            onClick={() => update({ status: null, due: 'today', view: null })}
            variant={filters.due === 'today' ? 'filled' : 'outlined'}
            color={filters.due === 'today' ? 'primary' : 'default'}
          />
        </Stack>
      </PageHeader>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={view}
          onChange={(_, value: TaskView) => update({ view: value === 'list' ? null : value })}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Task views"
        >
          {VIEW_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} icon={tab.icon} iconPosition="start" />
          ))}
        </Tabs>
      </Box>

      {view !== 'workload' && (
        <TaskFiltersBar
          filters={filters}
          sort={sort}
          showStatus={view === 'list'}
          showSort={view === 'list'}
          activeFilterCount={activeFilterCount}
          onChange={update}
          onClear={clear}
        />
      )}

      {renderContent()}

      {dialog && (
        <TaskDialog
          open
          onClose={() => setDialog(null)}
          task={dialog.mode === 'edit' ? dialog.task : undefined}
          defaults={dialog.mode === 'create' ? dialog.defaults : undefined}
        />
      )}
      <DeleteTaskDialog
        task={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          if (taskId) navigate(`${paths.tasks()}${search}`);
        }}
      />
      <TaskDetailDrawer
        taskId={taskId}
        onClose={() => navigate(`${paths.tasks()}${search}`)}
        onEdit={(task) => setDialog({ mode: 'edit', task })}
        onDelete={setDeleting}
        linkFor={linkForId}
      />
    </>
  );
}

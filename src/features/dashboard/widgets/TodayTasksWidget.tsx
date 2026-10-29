import { useMemo, useState } from 'react';
import { Box, Button, Checkbox, Link } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, CheckSquare, Plus } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppDispatch, useCan, useCollection, useToday } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { motionTokens } from '@/components/ui/motion';
import { quickAddOpened } from '@/store/uiSlice';
import { isTaskOverdue } from '@/features/tasks/logic';
import { useCompleteTask } from '@/features/tasks/hooks';
import { formatShortDate, formatTime } from '@/lib/dates';
import { paths } from '@/app/paths';
import type { Priority } from '@/types/models';
import { WidgetFooterLink, WidgetRow, rowLinkSx } from './WidgetList';

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export function TodayTasksWidget() {
  const tasks = useCollection('tasks');
  const today = useToday();
  const canEdit = useCan('edit');
  const complete = useCompleteTask();
  const dispatch = useAppDispatch();
  const [completing, setCompleting] = useState<string | null>(null);

  const due = useMemo(
    () =>
      tasks
        .filter((task) => task.status !== 'completed' && task.dueDate && task.dueDate <= today)
        .sort(
          (a, b) =>
            Number(isTaskOverdue(b, today)) - Number(isTaskOverdue(a, today)) ||
            (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99') ||
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
        ),
    [tasks, today],
  );
  const doneToday = tasks.filter((task) => task.status === 'completed' && task.completedAt?.slice(0, 10) === today).length;
  const visible = due.slice(0, 6);

  return (
    <SectionCard
      title="Today’s tasks"
      subtitle={due.length === 0 ? `${doneToday} completed today` : `${due.length} to do · ${doneToday} done today`}
      icon={<CheckSquare size={17} />}
      sx={{ height: '100%' }}
    >
      {due.length === 0 ? (
        <EmptyState
          compact
          icon={<CheckCircle2 size={20} />}
          title="Nothing due today"
          description={doneToday > 0 ? 'Everything due today is done. Nice work.' : 'No chores or tasks are due today.'}
          action={
            canEdit ? (
              <Button size="small" variant="outlined" startIcon={<Plus size={16} />} onClick={() => dispatch(quickAddOpened('task'))}>
                Create task
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Tasks due today">
          <AnimatePresence initial={false}>
            {visible.map((task) => {
              const overdue = isTaskOverdue(task, today);
              return (
                <motion.li
                  key={task.id}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={motionTokens.fast}
                  style={{ listStyle: 'none' }}
                >
                  <WidgetRow
                    leading={
                      <Checkbox
                        checked={completing === task.id}
                        disabled={!canEdit || completing === task.id}
                        onChange={async () => {
                          setCompleting(task.id);
                          await complete(task);
                          setCompleting(null);
                        }}
                        slotProps={{ input: { 'aria-label': `Mark “${task.title}” complete` } }}
                        sx={{ p: 0.5, ml: -0.5 }}
                      />
                    }
                    title={
                      <Link component={RouterLink} to={paths.task(task.id)} sx={rowLinkSx}>
                        {task.title}
                      </Link>
                    }
                    subtitle={[
                      overdue ? `Was due ${formatShortDate(task.dueDate!)}` : task.dueTime ? `Due ${formatTime(task.dueTime)}` : 'Due today',
                      task.category,
                    ].join(' · ')}
                    trailing={
                      <>
                        {overdue ? (
                          <StatusChip tone="danger" label="Overdue" />
                        ) : task.priority === 'high' ? (
                          <StatusChip tone="terracotta" label="High" />
                        ) : null}
                        <MemberAvatar userId={task.assigneeId} size={26} />
                      </>
                    }
                  />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </Box>
      )}
      <WidgetFooterLink to={paths.tasks({ due: 'today' })}>
        {due.length > visible.length ? `View all ${due.length} tasks` : 'Open tasks'}
      </WidgetFooterLink>
    </SectionCard>
  );
}

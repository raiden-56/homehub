import { Box, Card, Stack, Typography } from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import type { Task } from '@/types/models';
import { MotionItem } from '@/components/ui/motion';
import { TASK_GROUP_LABELS, groupTasks, type TaskSort } from '../logic';
import { TaskRow } from './TaskRow';

interface TaskListProps {
  tasks: Task[];
  sort: TaskSort;
  today: string;
  canEdit: boolean;
  linkFor: (task: Task) => string;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

/** Task rows; grouped into Overdue / Today / Upcoming / … when sorted by due date. */
export function TaskList({ tasks, sort, today, canEdit, linkFor, onEdit, onDelete }: TaskListProps) {
  const groups = sort === 'due' ? groupTasks(tasks, today) : [{ key: 'all' as const, tasks }];
  return (
    <Stack spacing={2}>
      {groups.map((group) => (
        <Card key={group.key} component="section" aria-labelledby={group.key !== 'all' ? `task-group-${group.key}` : undefined}>
          {group.key !== 'all' && (
            <Stack direction="row" spacing={1} alignItems="baseline" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
              <Typography
                id={`task-group-${group.key}`}
                variant="h4"
                component="h2"
                color={group.key === 'overdue' ? 'error.main' : 'text.primary'}
              >
                {TASK_GROUP_LABELS[group.key]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {group.tasks.length}
              </Typography>
            </Stack>
          )}
          <Box role="list">
            <AnimatePresence initial={false}>
              {group.tasks.map((task) => (
                <MotionItem key={task.id}>
                  <Box role="listitem">
                    <TaskRow
                      task={task}
                      today={today}
                      to={linkFor(task)}
                      canEdit={canEdit}
                      onEdit={() => onEdit(task)}
                      onDelete={() => onDelete(task)}
                    />
                  </Box>
                </MotionItem>
              ))}
            </AnimatePresence>
          </Box>
        </Card>
      ))}
    </Stack>
  );
}

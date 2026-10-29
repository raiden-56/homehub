import { useState } from 'react';
import { Box, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { Circle, CircleCheck, Clock, ListChecks, MessageSquare, Repeat } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import type { Task } from '@/types/models';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { StatusChip } from '@/components/ui/StatusChip';
import { formatTime, relativeDay } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrence';
import { PRIORITY_LABELS, PRIORITY_TONES, TASK_STATUS_LABELS, TASK_STATUS_TONES, displayStatus } from '../logic';
import { useCompleteTask, useReopenTask } from '../hooks';
import { TaskMenu } from './TaskMenu';

interface TaskRowProps {
  task: Task;
  today: string;
  to: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskRow({ task, today, to, canEdit, onEdit, onDelete }: TaskRowProps) {
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const reduce = useReducedMotion();
  const [justDone, setJustDone] = useState(false);
  const status = displayStatus(task, today);
  const done = task.status === 'completed';
  const checklistDone = task.checklist.filter((item) => item.done).length;

  const toggle = async () => {
    if (done) {
      await reopen(task);
      return;
    }
    setJustDone(true);
    const ok = await complete(task);
    if (!ok) setJustDone(false);
  };

  const checked = done || justDone;
  const due = task.dueDate
    ? `${relativeDay(task.dueDate, today)}${task.dueTime ? `, ${formatTime(task.dueTime)}` : ''}`
    : 'No due date';

  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="center"
      sx={{ px: { xs: 1, sm: 1.5 }, py: 1, borderBottom: 1, borderColor: 'divider', minHeight: 60, '&:last-of-type': { borderBottom: 0 } }}
    >
      <Tooltip title={!canEdit ? 'Viewers can’t complete tasks' : done ? 'Reopen task' : 'Mark complete'}>
        <span>
          <IconButton
            onClick={toggle}
            disabled={!canEdit}
            aria-label={done ? `Reopen “${task.title}”` : `Mark “${task.title}” complete`}
            aria-pressed={checked}
            sx={(theme) => ({ width: 40, height: 40, color: checked ? theme.tokens.success : theme.palette.text.secondary })}
          >
            <motion.span
              key={checked ? 'checked' : 'unchecked'}
              initial={reduce ? false : { scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              style={{ display: 'inline-flex' }}
            >
              {checked ? <CircleCheck size={22} /> : <Circle size={22} />}
            </motion.span>
          </IconButton>
        </span>
      </Tooltip>

      <Box component={RouterLink} to={to} sx={{ flex: 1, minWidth: 0, color: 'inherit', textDecoration: 'none', borderRadius: 1, py: 0.5 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: checked ? 'text.secondary' : 'text.primary',
            textDecoration: checked ? 'line-through' : 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.title}
        </Typography>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 0.25, color: 'text.secondary', minWidth: 0, overflow: 'hidden' }}>
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0 }}>
            <Clock size={12} aria-hidden />
            <Typography variant="caption" sx={{ color: status === 'overdue' ? 'error.main' : undefined, fontWeight: status === 'overdue' ? 700 : 400 }}>
              {due}
            </Typography>
          </Stack>
          <Typography variant="caption" noWrap sx={{ display: { xs: 'none', sm: 'block' } }}>
            {task.category}
          </Typography>
          {task.recurrence && (
            <Tooltip title={describeRecurrence(task.recurrence)}>
              <Box component="span" sx={{ display: 'inline-flex' }} aria-label={describeRecurrence(task.recurrence)} role="img">
                <Repeat size={12} />
              </Box>
            </Tooltip>
          )}
          {task.checklist.length > 0 && (
            <Stack direction="row" spacing={0.25} alignItems="center" aria-label={`${checklistDone} of ${task.checklist.length} checklist items done`} role="img">
              <ListChecks size={12} />
              <Typography variant="caption">
                {checklistDone}/{task.checklist.length}
              </Typography>
            </Stack>
          )}
          {task.comments.length > 0 && (
            <Stack direction="row" spacing={0.25} alignItems="center" aria-label={`${task.comments.length} comments`} role="img">
              <MessageSquare size={12} />
              <Typography variant="caption">{task.comments.length}</Typography>
            </Stack>
          )}
        </Stack>
      </Box>

      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }}>
        {(status === 'overdue' || status === 'in_progress') && (
          <StatusChip tone={TASK_STATUS_TONES[status]} label={TASK_STATUS_LABELS[status]} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
        )}
        {task.priority === 'high' && !done && (
          <StatusChip tone={PRIORITY_TONES.high} label={PRIORITY_LABELS.high} sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
        )}
        <MemberAvatar userId={task.assigneeId} size={28} />
        {canEdit && <TaskMenu task={task} onEdit={onEdit} onDelete={onDelete} />}
      </Stack>
    </Stack>
  );
}

import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { CircleCheck, Pencil, Plus, RotateCcw, Send, Trash2, X } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCan, useCollection, useCommit, useCurrentUser, useMembers, useRecord, useToday } from '@/app/hooks';
import { DetailDrawer, DetailRow } from '@/components/ui/DetailDrawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusChip } from '@/components/ui/StatusChip';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { formatDate, formatTime, formatTimestamp, relativeDay, timeAgo } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrence';
import { newId, nowIso } from '@/lib/ids';
import type { Task } from '@/types/models';
import {
  PRIORITY_LABELS,
  PRIORITY_TONES,
  TASK_STATUS_LABELS,
  TASK_STATUS_TONES,
  displayStatus,
  reminderLabel,
  seriesIdOf,
} from '../logic';
import { useCompleteTask, useReopenTask, useSetTaskStatus } from '../hooks';

interface TaskDetailDrawerProps {
  taskId: string | undefined;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  linkFor: (taskId: string) => string;
}

export function TaskDetailDrawer({ taskId, onClose, onEdit, onDelete, linkFor }: TaskDetailDrawerProps) {
  const task = useRecord('tasks', taskId);
  const today = useToday();
  const canEdit = useCan('edit');
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const setStatus = useSetTaskStatus();

  return (
    <DetailDrawer
      open={!!taskId}
      onClose={onClose}
      title={task?.title ?? 'Task'}
      subtitle={
        task ? (
          <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.75 }}>
            <StatusChip tone={TASK_STATUS_TONES[displayStatus(task, today)]} label={TASK_STATUS_LABELS[displayStatus(task, today)]} />
            <StatusChip tone={PRIORITY_TONES[task.priority]} label={`${PRIORITY_LABELS[task.priority]} priority`} />
            {task.recurrence && <StatusChip tone="neutral" label={describeRecurrence(task.recurrence)} />}
          </Stack>
        ) : undefined
      }
      actions={
        task && canEdit ? (
          <Tooltip title="Edit task">
            <IconButton aria-label="Edit task" onClick={() => onEdit(task)}>
              <Pencil size={18} />
            </IconButton>
          </Tooltip>
        ) : undefined
      }
    >
      {!task ? (
        <ErrorState kind="not-found" title="Task not found" description="It may have been deleted, or it belongs to another household." />
      ) : (
        <Stack spacing={3}>
          {canEdit && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              {task.status === 'completed' ? (
                <Button variant="outlined" startIcon={<RotateCcw size={16} />} onClick={() => reopen(task)}>
                  Reopen
                </Button>
              ) : (
                <Button variant="contained" startIcon={<CircleCheck size={16} />} onClick={() => complete(task)}>
                  Mark complete
                </Button>
              )}
              {task.status !== 'completed' && (
                <TextField
                  select
                  label="Status"
                  value={task.status}
                  onChange={(event) => setStatus(task, event.target.value as Task['status'])}
                  sx={{ minWidth: 160 }}
                >
                  <MenuItem value="not_started">Not started</MenuItem>
                  <MenuItem value="in_progress">In progress</MenuItem>
                </TextField>
              )}
            </Stack>
          )}

          <Box>
            <AssigneeRow task={task} canEdit={canEdit} />
            <DetailRow label="Due">
              {task.dueDate ? (
                <>
                  {formatDate(task.dueDate, 'EEE d MMM yyyy')}
                  {task.dueTime ? `, ${formatTime(task.dueTime)}` : ''}{' '}
                  <Typography component="span" variant="body2" color="text.secondary">
                    ({relativeDay(task.dueDate, today).toLowerCase()})
                  </Typography>
                </>
              ) : (
                'No due date'
              )}
            </DetailRow>
            <DetailRow label="Category">{task.category}</DetailRow>
            <DetailRow label="Repeats">{describeRecurrence(task.recurrence)}</DetailRow>
            <DetailRow label="Reminder">
              {task.reminderMinutesBefore !== undefined ? `${reminderLabel(task.reminderMinutesBefore)} (in-app)` : 'None'}
            </DetailRow>
            <DetailRow label="Created">
              <Stack direction="row" spacing={1} alignItems="center">
                <MemberAvatar userId={task.createdBy} size={20} />
                <span>{formatTimestamp(task.createdAt)}</span>
              </Stack>
            </DetailRow>
            {task.completedAt && (
              <DetailRow label="Completed">
                <Stack direction="row" spacing={1} alignItems="center">
                  <MemberAvatar userId={task.completedBy} size={20} />
                  <span>{formatTimestamp(task.completedAt)}</span>
                </Stack>
              </DetailRow>
            )}
          </Box>

          {task.description && <TextBlock title="Description" text={task.description} />}
          {task.notes && <TextBlock title="Notes" text={task.notes} />}

          <Checklist task={task} canEdit={canEdit} />
          <Comments task={task} canEdit={canEdit} />
          <SeriesHistory task={task} linkFor={linkFor} />
          <TaskActivity taskId={task.id} />

          {canEdit && (
            <>
              <Divider />
              <Box>
                <Button color="error" startIcon={<Trash2 size={16} />} onClick={() => onDelete(task)}>
                  Delete task
                </Button>
              </Box>
            </>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <Box>
      <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {text}
      </Typography>
    </Box>
  );
}

function AssigneeRow({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const members = useMembers();
  const commit = useCommit();
  const users = useAppSelector((state) => state.data.users);
  if (!canEdit) {
    return (
      <DetailRow label="Assigned to">
        <MemberAvatar userId={task.assigneeId} withName size={22} />
      </DetailRow>
    );
  }
  const reassign = (assigneeId: string) => {
    const name = assigneeId ? (users[assigneeId]?.name ?? 'a member') : 'nobody';
    void commit(
      { put: { tasks: [{ ...task, assigneeId: assigneeId || undefined, updatedAt: nowIso() }] } },
      {
        activity: { entity: 'task', entityId: task.id, message: `Assigned “${task.title}” to ${name}` },
        success: assigneeId ? `Assigned to ${name}` : 'Task unassigned',
        undo: { put: { tasks: [task] } },
      },
    );
  };
  return (
    <DetailRow label="Assigned to">
      <TextField
        select
        value={task.assigneeId ?? ''}
        onChange={(event) => reassign(event.target.value)}
        slotProps={{ htmlInput: { 'aria-label': 'Assigned to' } }}
        sx={{ maxWidth: 240 }}
      >
        <MenuItem value="">Unassigned</MenuItem>
        {members
          .filter((member) => member.role !== 'viewer' || member.userId === task.assigneeId)
          .map((member) => (
            <MenuItem key={member.userId} value={member.userId}>
              {member.name}
            </MenuItem>
          ))}
      </TextField>
    </DetailRow>
  );
}

function Checklist({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const commit = useCommit();
  const [text, setText] = useState('');
  const done = task.checklist.filter((item) => item.done).length;
  const save = (checklist: Task['checklist']) => commit({ put: { tasks: [{ ...task, checklist, updatedAt: nowIso() }] } });

  const add = async () => {
    const value = text.trim().slice(0, 200);
    if (!value) return;
    const ok = await save([...task.checklist, { id: newId(), text: value, done: false }]);
    if (ok) setText('');
  };

  return (
    <Box component="section" aria-labelledby="task-checklist-heading">
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75 }}>
        <Typography id="task-checklist-heading" variant="subtitle2" component="h3">
          Checklist
        </Typography>
        {task.checklist.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {done} of {task.checklist.length} done
          </Typography>
        )}
      </Stack>
      {task.checklist.length > 0 && (
        <LinearProgress
          variant="determinate"
          value={(done / task.checklist.length) * 100}
          aria-label="Checklist progress"
          sx={{ mb: 1, height: 6 }}
        />
      )}
      <Stack>
        {task.checklist.map((item) => (
          <Stack key={item.id} direction="row" alignItems="center" spacing={0.5}>
            <Checkbox
              checked={item.done}
              disabled={!canEdit}
              onChange={(event) =>
                save(task.checklist.map((entry) => (entry.id === item.id ? { ...entry, done: event.target.checked } : entry)))
              }
              slotProps={{ input: { 'aria-label': item.text } }}
            />
            <Typography
              variant="body2"
              sx={{ flex: 1, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'text.secondary' : 'text.primary', wordBreak: 'break-word' }}
            >
              {item.text}
            </Typography>
            {canEdit && (
              <IconButton
                size="small"
                aria-label={`Remove “${item.text}”`}
                onClick={() => save(task.checklist.filter((entry) => entry.id !== item.id))}
              >
                <X size={14} />
              </IconButton>
            )}
          </Stack>
        ))}
        {task.checklist.length === 0 && !canEdit && (
          <Typography variant="body2" color="text.secondary">
            No checklist items.
          </Typography>
        )}
      </Stack>
      {canEdit && (
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <TextField
            value={text}
            placeholder="Add a checklist item"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void add();
              }
            }}
            slotProps={{ htmlInput: { 'aria-label': 'New checklist item' } }}
          />
          <Button onClick={add} disabled={!text.trim()} startIcon={<Plus size={16} />} sx={{ flexShrink: 0 }}>
            Add
          </Button>
        </Stack>
      )}
    </Box>
  );
}

function Comments({ task, canEdit }: { task: Task; canEdit: boolean }) {
  const commit = useCommit();
  const user = useCurrentUser();
  const users = useAppSelector((state) => state.data.users);
  const [text, setText] = useState('');

  const add = async () => {
    const value = text.trim().slice(0, 1000);
    if (!value || !user) return;
    const ok = await commit(
      {
        put: {
          tasks: [
            {
              ...task,
              comments: [...task.comments, { id: newId(), authorId: user.id, text: value, createdAt: nowIso() }],
              updatedAt: nowIso(),
            },
          ],
        },
      },
      { activity: { entity: 'task', entityId: task.id, message: `Commented on “${task.title}”` } },
    );
    if (ok) setText('');
  };

  return (
    <Box component="section" aria-labelledby="task-comments-heading">
      <Typography id="task-comments-heading" variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        Comments
      </Typography>
      <Stack spacing={1.5}>
        {task.comments.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No comments yet.
          </Typography>
        )}
        {task.comments.map((comment) => (
          <Stack key={comment.id} direction="row" spacing={1.25}>
            <MemberAvatar userId={comment.authorId} size={28} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {users[comment.authorId]?.name ?? 'Former member'}
                </Box>{' '}
                · {timeAgo(comment.createdAt)}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {comment.text}
              </Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
      {canEdit && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} alignItems="flex-end">
          <TextField
            value={text}
            placeholder="Write a comment"
            multiline
            maxRows={4}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void add();
              }
            }}
            slotProps={{ htmlInput: { 'aria-label': 'New comment' } }}
          />
          <IconButton color="primary" aria-label="Post comment" onClick={add} disabled={!text.trim()}>
            <Send size={18} />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
}

function SeriesHistory({ task, linkFor }: { task: Task; linkFor: (taskId: string) => string }) {
  const tasks = useCollection('tasks');
  const history = useMemo(() => {
    if (!task.seriesId && !task.recurrence) return [];
    const seriesId = seriesIdOf(task);
    return tasks
      .filter((other) => other.id !== task.id && seriesIdOf(other) === seriesId && other.status === 'completed')
      .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      .slice(0, 10);
  }, [tasks, task]);
  if (history.length === 0) return null;
  return (
    <Box component="section" aria-labelledby="task-history-heading">
      <Typography id="task-history-heading" variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        Completion history
      </Typography>
      <Stack spacing={1}>
        {history.map((entry) => (
          <Stack key={entry.id} direction="row" spacing={1.25} alignItems="center">
            <MemberAvatar userId={entry.completedBy} size={24} />
            <Typography variant="body2" component={RouterLink} to={linkFor(entry.id)} sx={{ color: 'text.primary' }}>
              {entry.completedAt ? formatTimestamp(entry.completedAt, 'EEE d MMM yyyy') : 'Completed'}
            </Typography>
            {entry.dueDate && (
              <Typography variant="caption" color="text.secondary">
                (due {formatDate(entry.dueDate, 'd MMM')})
              </Typography>
            )}
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

function TaskActivity({ taskId }: { taskId: string }) {
  const activity = useCollection('activity');
  const users = useAppSelector((state) => state.data.users);
  const entries = useMemo(
    () => activity.filter((entry) => entry.entityId === taskId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
    [activity, taskId],
  );
  if (entries.length === 0) return null;
  return (
    <Box component="section" aria-labelledby="task-activity-heading">
      <Typography id="task-activity-heading" variant="subtitle2" component="h3" sx={{ mb: 1 }}>
        Activity
      </Typography>
      <Stack spacing={0.75}>
        {entries.map((entry) => (
          <Typography key={entry.id} variant="caption" color="text.secondary">
            <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {users[entry.actorId]?.name ?? 'Someone'}
            </Box>{' '}
            {entry.message.charAt(0).toLowerCase() + entry.message.slice(1)} · {timeAgo(entry.createdAt)}
          </Typography>
        ))}
      </Stack>
    </Box>
  );
}

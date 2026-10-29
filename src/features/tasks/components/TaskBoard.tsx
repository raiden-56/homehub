import { useEffect, useMemo, useState } from 'react';
import { Box, Card, Stack, Typography } from '@mui/material';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useReducedMotion } from 'framer-motion';
import { Link as RouterLink } from 'react-router-dom';
import { Clock, GripVertical, Repeat } from 'lucide-react';
import type { Task, TaskStatus } from '@/types/models';
import type { ChangeSet } from '@/data/collections';
import { useCommit, useCurrentUser } from '@/app/hooks';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { StatusChip } from '@/components/ui/StatusChip';
import { relativeDay } from '@/lib/dates';
import { nowIso } from '@/lib/ids';
import { useStore } from 'react-redux';
import type { RootState } from '@/app/store';
import {
  BOARD_COLUMNS,
  PRIORITY_LABELS,
  PRIORITY_TONES,
  buildCompletion,
  buildReopen,
  isTaskOverdue,
} from '../logic';
import { TaskMenu } from './TaskMenu';

type Columns = Record<TaskStatus, string[]>;

function buildColumns(tasks: Task[]): Columns {
  const columns: Columns = { not_started: [], in_progress: [], completed: [] };
  const sorted = [...tasks].sort(
    (a, b) => a.boardOrder - b.boardOrder || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title),
  );
  for (const task of sorted) columns[task.status].push(task.id);
  return columns;
}

function columnOf(columns: Columns, id: UniqueIdentifier): TaskStatus | undefined {
  if (id in columns) return id as TaskStatus;
  return (Object.keys(columns) as TaskStatus[]).find((status) => columns[status].includes(String(id)));
}

const COLUMN_LABEL = Object.fromEntries(BOARD_COLUMNS.map((column) => [column.status, column.label])) as Record<TaskStatus, string>;

interface TaskBoardProps {
  tasks: Task[];
  today: string;
  canEdit: boolean;
  linkFor: (task: Task) => string;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

/** Kanban board. Drag cards (mouse, touch or keyboard) or use each card's "Move to…" menu. */
export function TaskBoard({ tasks, today, canEdit, linkFor, onEdit, onDelete }: TaskBoardProps) {
  const commit = useCommit();
  const store = useStore<RootState>();
  const user = useCurrentUser();
  const reduce = useReducedMotion();
  const byId = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const [columns, setColumns] = useState<Columns>(() => buildColumns(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [startColumn, setStartColumn] = useState<TaskStatus | null>(null);

  // Re-sync from the store whenever tasks change and nothing is being dragged.
  useEffect(() => {
    if (!activeId) setColumns(buildColumns(tasks));
  }, [tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const titleOf = (id: UniqueIdentifier) => byId.get(String(id))?.title ?? 'task';
  const positionText = (id: UniqueIdentifier, overId: UniqueIdentifier | undefined) => {
    if (overId === undefined) return '';
    const column = columnOf(columns, overId);
    if (!column) return '';
    const index = columns[column].indexOf(String(id));
    return `${COLUMN_LABEL[column]}, position ${index + 1} of ${columns[column].length}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up “${titleOf(active.id)}”.`,
    onDragOver: ({ active, over }) => (over ? `“${titleOf(active.id)}” is over ${positionText(active.id, over.id)}.` : `“${titleOf(active.id)}” is no longer over a column.`),
    onDragEnd: ({ active, over }) => (over ? `Dropped “${titleOf(active.id)}” in ${positionText(active.id, over.id)}.` : `Dropped “${titleOf(active.id)}”.`),
    onDragCancel: ({ active }) => `Moving “${titleOf(active.id)}” was cancelled.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
    setStartColumn(columnOf(columns, active.id) ?? null);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = columnOf(columns, active.id);
    const to = columnOf(columns, over.id);
    if (!from || !to || from === to) return;
    setColumns((current) => {
      const source = current[from].filter((id) => id !== String(active.id));
      const target = [...current[to]];
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, String(active.id));
      return { ...current, [from]: source, [to]: target };
    });
  };

  const persist = async (next: Columns, movedId: string, from: TaskStatus, to: TaskStatus) => {
    const all = store.getState().data.tasks;
    const moved = all[movedId];
    if (!moved || !user) return;
    const now = nowIso();
    const puts = new Map<string, Task>();
    next[to].forEach((id, index) => {
      const task = all[id];
      if (task && (task.boardOrder !== index + 1 || id === movedId)) puts.set(id, { ...task, boardOrder: index + 1, updatedAt: now });
    });
    let changes: ChangeSet;
    let message: string;
    let undoRemove: string[] = [];
    if (from !== to && to === 'completed') {
      const base = puts.get(movedId) ?? moved;
      const result = buildCompletion(base, all, { today, now, userId: user.id });
      for (const task of result.changes.put?.tasks ?? []) puts.set(task.id, task);
      if (result.next) undoRemove = [result.next.id];
      changes = { put: { tasks: [...puts.values()] } };
      message = `Completed “${moved.title}”`;
    } else if (from !== to && from === 'completed') {
      puts.set(movedId, buildReopen(puts.get(movedId) ?? moved, now, to as Exclude<TaskStatus, 'completed'>));
      changes = { put: { tasks: [...puts.values()] } };
      message = `Reopened “${moved.title}”`;
    } else if (from !== to) {
      puts.set(movedId, { ...(puts.get(movedId) ?? moved), status: to, updatedAt: now });
      changes = { put: { tasks: [...puts.values()] } };
      message = `Moved “${moved.title}” to ${COLUMN_LABEL[to].toLowerCase()}`;
    } else {
      if (puts.size === 0) return;
      await commit({ put: { tasks: [...puts.values()] } });
      return;
    }
    const previous = [...puts.keys()].map((id) => all[id]).filter((task): task is Task => !!task);
    await commit(changes, {
      activity: { entity: 'task', entityId: movedId, message },
      success: message,
      undo: { put: { tasks: previous }, ...(undoRemove.length ? { remove: { tasks: undoRemove } } : {}) },
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    const from = startColumn;
    setActiveId(null);
    setStartColumn(null);
    if (!over || !from) {
      setColumns(buildColumns(tasks));
      return;
    }
    const to = columnOf(columns, over.id);
    if (!to) return;
    let next = columns;
    const oldIndex = columns[to].indexOf(id);
    const newIndex = columns[to].indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      next = { ...columns, [to]: arrayMove(columns[to], oldIndex, newIndex) };
      setColumns(next);
    }
    void persist(next, id, from, to);
  };

  const activeTask = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setStartColumn(null);
        setColumns(buildColumns(tasks));
      }}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            'To move a task, press space or enter to pick it up. Use the arrow keys to move it between positions and columns, then press space or enter to drop it, or escape to cancel. You can also use the task’s actions menu.',
        },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(3, minmax(260px, 85vw))', sm: 'repeat(3, minmax(260px, 1fr))' },
          gap: 2,
          overflowX: 'auto',
          pb: 1,
          scrollSnapType: { xs: 'x mandatory', md: 'none' },
        }}
        aria-label="Task board"
      >
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column.status}
            status={column.status}
            label={column.label}
            ids={columns[column.status]}
            byId={byId}
            today={today}
            canEdit={canEdit}
            linkFor={linkFor}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </Box>
      <DragOverlay dropAnimation={reduce ? null : { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeTask ? <BoardCard task={activeTask} today={today} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

interface BoardColumnProps {
  status: TaskStatus;
  label: string;
  ids: string[];
  byId: Map<string, Task>;
  today: string;
  canEdit: boolean;
  linkFor: (task: Task) => string;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function BoardColumn({ status, label, ids, byId, today, canEdit, linkFor, onEdit, onDelete }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canEdit });
  return (
    <Card
      component="section"
      aria-labelledby={`board-${status}`}
      sx={(theme) => ({
        p: 1.25,
        scrollSnapAlign: 'start',
        backgroundColor: isOver ? theme.tokens.sage : theme.tokens.surfaceMuted,
        borderColor: isOver ? theme.palette.primary.main : theme.palette.divider,
        transition: 'background-color 160ms ease, border-color 160ms ease',
        minHeight: 240,
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ px: 0.75, pb: 1 }}>
        <Typography id={`board-${status}`} variant="h4" component="h2">
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {ids.length}
        </Typography>
      </Stack>
      <SortableContext id={status} items={ids} strategy={verticalListSortingStrategy}>
        <Stack ref={setNodeRef} spacing={1} sx={{ flex: 1, minHeight: 80 }} role="list">
          {ids.map((id) => {
            const task = byId.get(id);
            if (!task) return null;
            return (
              <SortableCard
                key={id}
                task={task}
                today={today}
                canEdit={canEdit}
                to={linkFor(task)}
                onEdit={() => onEdit(task)}
                onDelete={() => onDelete(task)}
              />
            );
          })}
          {ids.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2 }}>
              {canEdit ? 'Drop tasks here' : 'No tasks'}
            </Typography>
          )}
        </Stack>
      </SortableContext>
    </Card>
  );
}

interface SortableCardProps {
  task: Task;
  today: string;
  canEdit: boolean;
  to: string;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableCard({ task, today, canEdit, to, onEdit, onDelete }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !canEdit });
  return (
    <Box
      ref={setNodeRef}
      role="listitem"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      sx={(theme) =>
        isDragging
          ? {
              // Insertion indicator: the card's slot stays visible as a dashed placeholder.
              borderRadius: 3,
              border: `2px dashed ${theme.palette.primary.main}`,
              backgroundColor: theme.tokens.sage,
              '& > *': { visibility: 'hidden' },
            }
          : {}
      }
    >
      <BoardCard
        task={task}
        today={today}
        to={to}
        dragHandle={
          canEdit ? (
            <Box
              component="button"
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`Drag “${task.title}”`}
              sx={{
                border: 0,
                bgcolor: 'transparent',
                color: 'text.secondary',
                cursor: 'grab',
                display: 'grid',
                placeItems: 'center',
                width: 32,
                height: 40,
                borderRadius: 1.5,
                touchAction: 'none',
                '&:focus-visible': { outline: 2, outlineStyle: 'solid', outlineColor: 'primary.main' },
              }}
            >
              <GripVertical size={16} />
            </Box>
          ) : undefined
        }
        menu={canEdit ? <TaskMenu task={task} onEdit={onEdit} onDelete={onDelete} showMove /> : undefined}
      />
    </Box>
  );
}

interface BoardCardProps {
  task: Task;
  today: string;
  to?: string;
  overlay?: boolean;
  dragHandle?: React.ReactNode;
  menu?: React.ReactNode;
}

function BoardCard({ task, today, to, overlay, dragHandle, menu }: BoardCardProps) {
  const overdue = isTaskOverdue(task, today);
  const done = task.status === 'completed';
  return (
    <Card
      sx={{
        p: 1,
        pl: dragHandle ? 0.25 : 1.25,
        display: 'flex',
        gap: 0.5,
        alignItems: 'flex-start',
        boxShadow: overlay ? '0 12px 28px rgba(36, 69, 45, 0.18)' : 'none',
        transform: overlay ? 'rotate(1deg)' : undefined,
        cursor: overlay ? 'grabbing' : undefined,
      }}
    >
      {dragHandle}
      <Box sx={{ flex: 1, minWidth: 0, py: 0.5 }}>
        <Typography
          variant="body2"
          component={to ? RouterLink : 'p'}
          {...(to ? { to } : {})}
          sx={{
            fontWeight: 600,
            color: done ? 'text.secondary' : 'text.primary',
            textDecoration: done ? 'line-through' : 'none',
            display: 'block',
            '&:hover': { textDecoration: to ? 'underline' : undefined },
          }}
        >
          {task.title}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
          {task.dueDate && (
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: overdue ? 'error.main' : 'text.secondary' }}>
              <Clock size={12} aria-hidden />
              <Typography variant="caption" sx={{ fontWeight: overdue ? 700 : 400 }}>
                {overdue ? 'Overdue · ' : ''}
                {relativeDay(task.dueDate, today)}
              </Typography>
            </Stack>
          )}
          {task.recurrence && <Repeat size={12} aria-label="Repeats" role="img" />}
          {!done && task.priority !== 'medium' && <StatusChip tone={PRIORITY_TONES[task.priority]} label={PRIORITY_LABELS[task.priority]} />}
          <Box sx={{ flex: 1 }} />
          <MemberAvatar userId={task.assigneeId} size={24} />
        </Stack>
      </Box>
      {menu}
    </Card>
  );
}

import { useState } from 'react';
import { Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import { ArrowRightLeft, CircleCheck, EllipsisVertical, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import type { Task, TaskStatus } from '@/types/models';
import { BOARD_COLUMNS } from '../logic';
import { useSetTaskStatus } from '../hooks';

interface TaskMenuProps {
  task: Task;
  onEdit: () => void;
  onDelete: () => void;
  /** Adds "Move to…" options (keyboard alternative to dragging on the board). */
  showMove?: boolean;
}

export function TaskMenu({ task, onEdit, onDelete, showMove }: TaskMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const setStatus = useSetTaskStatus();
  const close = () => setAnchor(null);
  const run = (action: () => void) => () => {
    close();
    action();
  };
  const move = (status: TaskStatus) => run(() => void setStatus(task, status));

  return (
    <>
      <IconButton
        aria-label={`More actions for “${task.title}”`}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setAnchor(event.currentTarget);
        }}
        sx={{ width: 40, height: 40 }}
      >
        <EllipsisVertical size={18} />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={close} onClick={(event) => event.stopPropagation()}>
        <MenuItem onClick={run(onEdit)}>
          <ListItemIcon>
            <Pencil size={16} />
          </ListItemIcon>
          <ListItemText primary="Edit" />
        </MenuItem>
        {!showMove && task.status === 'not_started' && (
          <MenuItem onClick={move('in_progress')}>
            <ListItemIcon>
              <Play size={16} />
            </ListItemIcon>
            <ListItemText primary="Start (in progress)" />
          </MenuItem>
        )}
        {!showMove &&
          (task.status === 'completed' ? (
            <MenuItem onClick={move('not_started')}>
              <ListItemIcon>
                <RotateCcw size={16} />
              </ListItemIcon>
              <ListItemText primary="Reopen" />
            </MenuItem>
          ) : (
            <MenuItem onClick={move('completed')}>
              <ListItemIcon>
                <CircleCheck size={16} />
              </ListItemIcon>
              <ListItemText primary="Mark complete" />
            </MenuItem>
          ))}
        {showMove &&
          BOARD_COLUMNS.filter((column) => column.status !== task.status).map((column) => (
            <MenuItem key={column.status} onClick={move(column.status)}>
              <ListItemIcon>
                <ArrowRightLeft size={16} />
              </ListItemIcon>
              <ListItemText primary={`Move to ${column.label}`} />
            </MenuItem>
          ))}
        <Divider />
        <MenuItem onClick={run(onDelete)} sx={{ color: 'error.main' }}>
          <ListItemIcon sx={{ color: 'inherit' }}>
            <Trash2 size={16} />
          </ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>
    </>
  );
}

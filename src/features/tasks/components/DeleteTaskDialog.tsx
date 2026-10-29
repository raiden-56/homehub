import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';
import type { Task } from '@/types/models';
import { useDeleteTask, type DeleteMode } from '../hooks';

interface DeleteTaskDialogProps {
  task: Task | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/** Confirms deletion; repeating tasks choose between removing one occurrence or the whole series. */
export function DeleteTaskDialog({ task, onClose, onDeleted }: DeleteTaskDialogProps) {
  const remove = useDeleteTask();
  const [mode, setMode] = useState<DeleteMode>('skip');
  const [busy, setBusy] = useState(false);
  const recurring = !!task?.recurrence && task.status !== 'completed';

  const confirm = async () => {
    if (!task) return;
    setBusy(true);
    const ok = await remove(task, recurring ? mode : 'single');
    setBusy(false);
    if (ok) {
      onClose();
      onDeleted?.();
    }
  };

  return (
    <Dialog
      open={!!task}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="delete-task-title"
      slotProps={{ transition: { onExited: () => setMode('skip') } }}
    >
      <DialogTitle id="delete-task-title">Delete “{task?.title}”?</DialogTitle>
      <DialogContent>
        {recurring ? (
          <>
            <DialogContentText sx={{ mb: 1.5 }}>This task repeats. What would you like to delete?</DialogContentText>
            <RadioGroup value={mode} onChange={(event) => setMode(event.target.value as DeleteMode)} aria-label="Delete option">
              <FormControlLabel
                value="skip"
                control={<Radio />}
                label={
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Delete this occurrence only
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      The next one will still be scheduled.
                    </Typography>
                  </>
                }
                sx={{ alignItems: 'flex-start', mb: 1, '& .MuiRadio-root': { pt: 0.25 } }}
              />
              <FormControlLabel
                value="series"
                control={<Radio />}
                label={
                  <>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Delete and stop repeating
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Removes all open occurrences. Completed history is kept.
                    </Typography>
                  </>
                }
                sx={{ alignItems: 'flex-start', '& .MuiRadio-root': { pt: 0.25 } }}
              />
            </RadioGroup>
          </>
        ) : (
          <DialogContentText>The task, its checklist and comments will be removed.</DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={busy}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

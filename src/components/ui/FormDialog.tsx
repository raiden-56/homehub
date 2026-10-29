import type { FormEventHandler, ReactNode } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  type Breakpoint,
} from '@mui/material';
import { X } from 'lucide-react';

interface FormDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  submitLabel?: string;
  submitting?: boolean;
  /** Disable the submit button (e.g. viewer role). */
  submitDisabled?: boolean;
  children: ReactNode;
  maxWidth?: Breakpoint;
  /** Extra actions on the left of the footer (e.g. Delete). */
  secondaryActions?: ReactNode;
}

/**
 * Standard form dialog: centred on desktop, full-screen sheet on phones with the primary
 * action kept in a sticky footer.
 */
export function FormDialog({
  open,
  onClose,
  title,
  description,
  onSubmit,
  submitLabel = 'Save',
  submitting,
  submitDisabled,
  children,
  maxWidth = 'sm',
  secondaryActions,
}: FormDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const titleId = `form-dialog-${title.replace(/\W+/g, '-').toLowerCase()}`;

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={titleId}
      slotProps={{
        paper: {
          component: 'form',
          noValidate: true,
          onSubmit,
        } as object,
      }}
    >
      <DialogTitle id={titleId} sx={{ pr: 7 }}>
        {title}
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
            {description}
          </Typography>
        )}
      </DialogTitle>
      <IconButton
        aria-label="Close"
        onClick={onClose}
        disabled={submitting}
        sx={{ position: 'absolute', right: 12, top: 14 }}
      >
        <X size={20} />
      </IconButton>
      <DialogContent>
        <Box sx={{ pt: 1 }}>{children}</Box>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: 1,
          borderColor: 'divider',
          pt: 1.5,
          pb: fullScreen ? 'calc(16px + env(safe-area-inset-bottom))' : 2.5,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ mr: 'auto' }}>
          {secondaryActions}
        </Stack>
        <Button onClick={onClose} color="inherit" disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={submitting || submitDisabled}>
          {submitting ? 'Saving…' : submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import type { ReactNode } from 'react';
import { Box, Drawer, IconButton, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { X } from 'lucide-react';

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Header actions (edit, more…). */
  actions?: ReactNode;
  children: ReactNode;
  width?: number;
}

/** Contextual side panel for record details; becomes a bottom sheet on phones. */
export function DetailDrawer({ open, onClose, title, subtitle, actions, children, width = 460 }: DetailDrawerProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Drawer
      anchor={isMobile ? 'bottom' : 'right'}
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          sx: isMobile
            ? {
                maxHeight: '92dvh',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                pb: 'env(safe-area-inset-bottom)',
              }
            : { width, maxWidth: '100vw' },
        } as object,
      }}
    >
      {isMobile && (
        <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1 }} />
      )}
      <Stack
        direction="row"
        alignItems="flex-start"
        spacing={1}
        sx={{ px: 2.5, pt: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h2" component="h2" sx={{ wordBreak: 'break-word' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions}
        <IconButton aria-label="Close details" onClick={onClose} edge="end">
          <X size={20} />
        </IconButton>
      </Stack>
      <Box sx={{ px: 2.5, py: 2, overflowY: 'auto', flex: 1 }}>{children}</Box>
    </Drawer>
  );
}

/** Label/value row used inside detail panels. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={2} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="body2" color="text.secondary" sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ minWidth: 0, wordBreak: 'break-word', flex: 1 }}>
        {children}
      </Typography>
    </Stack>
  );
}

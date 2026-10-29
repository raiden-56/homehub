import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Compact variant for use inside dashboard widgets and small cards. */
  compact?: boolean;
}

export function EmptyState({ icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <Stack
      alignItems="center"
      textAlign="center"
      spacing={compact ? 1 : 1.5}
      sx={{ py: compact ? 3 : 7, px: 2 }}
      role="status"
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          display: 'grid',
          placeItems: 'center',
          width: compact ? 40 : 56,
          height: compact ? 40 : 56,
          borderRadius: '50%',
          backgroundColor: theme.tokens.sage,
          color: theme.tokens.sageText,
          mb: compact ? 0 : 0.5,
        })}
      >
        {icon}
      </Box>
      <Typography variant={compact ? 'h5' : 'h3'} component="p">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ pt: compact ? 0.5 : 1 }}>{action}</Box>}
    </Stack>
  );
}

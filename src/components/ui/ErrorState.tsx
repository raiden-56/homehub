import type { ReactNode } from 'react';
import { Button, Stack, Typography, Box } from '@mui/material';
import { AlertTriangle, Lock, SearchX } from 'lucide-react';

interface ErrorStateProps {
  kind?: 'error' | 'not-found' | 'forbidden';
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  action?: ReactNode;
}

const DEFAULTS = {
  error: {
    icon: AlertTriangle,
    title: 'Something went wrong',
    description: 'This section could not be loaded. Your data has not been changed.',
  },
  'not-found': {
    icon: SearchX,
    title: 'We couldn’t find that',
    description: 'It may have been deleted, archived, or it belongs to a different household.',
  },
  forbidden: {
    icon: Lock,
    title: 'You don’t have access',
    description: 'Your role in this household doesn’t allow this. Ask the household owner if you need access.',
  },
} as const;

export function ErrorState({ kind = 'error', title, description, onRetry, action }: ErrorStateProps) {
  const preset = DEFAULTS[kind];
  const Icon = preset.icon;
  return (
    <Stack alignItems="center" textAlign="center" spacing={1.5} sx={{ py: 7, px: 2 }} role="alert">
      <Box
        aria-hidden
        sx={(theme) => ({
          display: 'grid',
          placeItems: 'center',
          width: 56,
          height: 56,
          borderRadius: '50%',
          backgroundColor: kind === 'error' ? theme.tokens.errorSoft : theme.tokens.neutralSoft,
          color: kind === 'error' ? theme.tokens.errorText : theme.tokens.textSecondary,
        })}
      >
        <Icon size={24} />
      </Box>
      <Typography variant="h3" component="p">
        {title ?? preset.title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        {description ?? preset.description}
      </Typography>
      <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
        {onRetry && (
          <Button variant="contained" onClick={onRetry}>
            Try again
          </Button>
        )}
        {action}
      </Stack>
    </Stack>
  );
}

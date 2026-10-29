import type { ReactNode } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import { ArrowRight } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

/** Row layout shared by dashboard widgets: leading control, text, trailing meta. */
export function WidgetRow({
  leading,
  title,
  subtitle,
  trailing,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{ py: 1.1, borderTop: 1, borderColor: 'divider', '&:first-of-type': { borderTop: 0 }, minHeight: 52 }}
    >
      {leading}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" component="div" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {subtitle}
          </Typography>
        )}
      </Box>
      {trailing && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          {trailing}
        </Stack>
      )}
    </Stack>
  );
}

export function WidgetFooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Box sx={{ pt: 1.5 }}>
      <Button component={RouterLink} to={to} size="small" endIcon={<ArrowRight size={15} />} sx={{ px: 1, ml: -1 }}>
        {children}
      </Button>
    </Box>
  );
}

/** Text links inside widget rows: inherit colour, underline on hover/focus. */
export const rowLinkSx = {
  color: 'inherit',
  textDecoration: 'none',
  '&:hover, &:focus-visible': { textDecoration: 'underline' },
} as const;

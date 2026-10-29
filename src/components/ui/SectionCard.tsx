import type { ReactNode } from 'react';
import { Box, Card, Stack, Typography, type SxProps, type Theme } from '@mui/material';

interface SectionCardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  /** Remove inner padding (for edge-to-edge lists and tables). */
  flush?: boolean;
  sx?: SxProps<Theme>;
  /** Heading level for the title; defaults to h2 for page sections. */
  headingComponent?: 'h2' | 'h3';
}

export function SectionCard({
  title,
  subtitle,
  icon,
  action,
  children,
  flush,
  sx,
  headingComponent = 'h2',
}: SectionCardProps) {
  return (
    <Card component="section" sx={{ display: 'flex', flexDirection: 'column', ...sx }}>
      {(title || action) && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1.5}
          sx={{ px: 2.5, pt: 2, pb: flush ? 1.5 : 0.5 }}
        >
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            {icon && (
              <Box
                aria-hidden
                sx={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 2,
                  backgroundColor: (theme) => theme.tokens.sage,
                  color: (theme) => theme.tokens.sageText,
                  flexShrink: 0,
                }}
              >
                {icon}
              </Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              {title && (
                <Typography variant="h3" component={headingComponent} noWrap>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary" component="p" noWrap>
                  {subtitle}
                </Typography>
              )}
            </Box>
          </Stack>
          {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
        </Stack>
      )}
      <Box sx={{ flex: 1, ...(flush ? {} : { px: 2.5, pb: 2.5, pt: title ? 1.5 : 2.5 }) }}>{children}</Box>
    </Card>
  );
}

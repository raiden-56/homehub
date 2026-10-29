import type { ReactNode } from 'react';
import { Box, Card, CardActionArea, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import type { StatusTone } from './StatusChip';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  /** Short supporting context, e.g. "2 overdue". */
  detail?: ReactNode;
  /** Colour of the icon well; the label always carries the meaning. */
  tone?: StatusTone;
  /** Destination (with filters applied) when the card is clicked. */
  to: string;
}

export function StatCard({ label, value, icon, detail, tone = 'primary', to }: StatCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        transition: 'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 6px 18px rgba(36, 69, 45, 0.08)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardActionArea component={RouterLink} to={to} sx={{ height: '100%', p: { xs: 1.5, sm: 2 }, borderRadius: 'inherit' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 1.5 }} alignItems="flex-start">
          <Box
            aria-hidden
            sx={(theme) => {
              const colours: Record<StatusTone, [string, string]> = {
                neutral: [theme.tokens.neutralSoft, theme.tokens.textSecondary],
                primary: [theme.tokens.sage, theme.tokens.sageText],
                success: [theme.tokens.successSoft, theme.tokens.successText],
                warning: [theme.tokens.amberSoft, theme.tokens.amberText],
                danger: [theme.tokens.errorSoft, theme.tokens.errorText],
                terracotta: [theme.tokens.terracottaSoft, theme.tokens.terracottaText],
              };
              const [bg, fg] = colours[tone];
              return {
                display: 'grid',
                placeItems: 'center',
                width: 36,
                height: 36,
                borderRadius: 2.5,
                backgroundColor: bg,
                color: fg,
                flexShrink: 0,
              };
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="h2"
              component="p"
              sx={{
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.15,
                fontSize: { xs: '1.125rem', sm: '1.375rem' },
                overflowWrap: 'anywhere',
              }}
            >
              {value}
            </Typography>
            <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600, mt: 0.25 }}>
              {label}
            </Typography>
            {detail && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.25 }}>
                {detail}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

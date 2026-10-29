import { useMemo } from 'react';
import { Box, Link, Stack, Typography } from '@mui/material';
import { AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useActiveHousehold, useAppSelector, useCurrency, useToday } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { computeInsights, type Insight } from '../insights';

const ICONS: Record<Insight['tone'], typeof Info> = { positive: CheckCircle2, attention: AlertTriangle, neutral: Info };

export function InsightsWidget() {
  const data = useAppSelector((state) => state.data);
  const household = useActiveHousehold();
  const currency = useCurrency();
  const today = useToday();
  const insights = useMemo(
    () => computeInsights(data, today, currency, household?.enabledModules ?? []),
    [data, today, currency, household?.enabledModules],
  );

  return (
    <SectionCard title="Household insights" subtitle="Calculated from your own records" icon={<Lightbulb size={17} />} sx={{ height: '100%' }}>
      {insights.length === 0 ? (
        <EmptyState compact icon={<Lightbulb size={20} />} title="Nothing notable right now" description="As you record spending, stock and chores, useful observations will appear here." />
      ) : (
        <Stack component="ul" spacing={1.25} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {insights.map((insight) => {
            const Icon = ICONS[insight.tone];
            return (
              <Stack component="li" key={insight.key} direction="row" spacing={1.25} alignItems="flex-start">
                <Box
                  aria-hidden
                  sx={(theme) => ({
                    mt: '2px',
                    color: insight.tone === 'attention' ? theme.tokens.amberText : insight.tone === 'positive' ? theme.tokens.successText : theme.tokens.textSecondary,
                  })}
                >
                  <Icon size={16} />
                </Box>
                <Typography variant="body2">
                  <Link component={RouterLink} to={insight.to} sx={{ color: 'text.primary', textDecorationColor: 'rgba(0,0,0,0.2)' }}>
                    {insight.text}
                  </Link>
                </Typography>
              </Stack>
            );
          })}
        </Stack>
      )}
    </SectionCard>
  );
}

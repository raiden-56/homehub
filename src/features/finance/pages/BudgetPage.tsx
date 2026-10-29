import { useMemo, useState } from 'react';
import { Box, Card, IconButton, LinearProgress, Stack, Typography, useTheme } from '@mui/material';
import { ChevronLeft, ChevronRight, PiggyBank } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useCollection, useCurrency, useHouseholdLoading, useRecord, useActiveHousehold, useToday } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { DashboardChartSkeleton, DashboardMetricSkeleton } from '@/components/ui/Skeletons';
import { Money, useFormatMoney } from '@/components/ui/Money';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { formatMonth, monthKey } from '@/lib/dates';
import { toMajor } from '@/lib/money';
import { budgetSummary, type BudgetState } from '../logic/budget';
import { shiftMonth } from '../logic/spending';
import { BudgetDialog } from '../components/BudgetDialog';
import { EditButton } from '../components/EditButton';
import { ChartFigure, useAxisMoney, useChartColors } from '../components/ChartFigure';

const STATE_TONE: Record<BudgetState, StatusTone> = { ok: 'success', warning: 'warning', over: 'danger' };
const STATE_LABEL: Record<BudgetState, string> = { ok: 'On track', warning: 'Nearing limit', over: 'Over budget' };

function isMonth(value: string | null): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export default function BudgetPage() {
  const loading = useHouseholdLoading();
  const household = useActiveHousehold();
  const budget = useRecord('budgets', household?.id);
  const expenses = useCollection('expenses');
  const today = useToday();
  const currency = useCurrency();
  const formatMoney = useFormatMoney();
  const colors = useChartColors();
  const axisMoney = useAxisMoney();
  const theme = useTheme();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(false);
  const currentMonth = monthKey(today);
  const monthParam = params.get('month');
  const month = isMonth(monthParam) ? monthParam : currentMonth;

  const setMonth = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === currentMonth) next.delete('month');
    else next.set('month', value);
    setParams(next, { replace: true });
  };

  const summary = useMemo(() => (budget ? budgetSummary(budget, expenses, month) : null), [budget, expenses, month]);
  const trend = useMemo(() => {
    if (!budget) return [];
    return Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5)).map((key) => {
      const entry = budgetSummary(budget, expenses, key);
      return { month: key, label: formatMonth(key).split(' ')[0], actual: entry.actualMinor, planned: entry.plannedMinor };
    });
  }, [budget, expenses, month]);

  if (loading) {
    return (
      <Stack spacing={2}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
          <DashboardMetricSkeleton />
          <DashboardMetricSkeleton />
          <DashboardMetricSkeleton />
        </Box>
        <DashboardChartSkeleton />
      </Stack>
    );
  }

  if (!budget || !summary) {
    return (
      <Card>
        <EmptyState
          icon={<PiggyBank size={24} />}
          title="No budget yet"
          description="Set a monthly budget — overall or per category — and HomeHub will compare it with what you actually record."
          action={
            <EditButton variant="contained" onClick={() => setEditing(true)}>
              Set a budget
            </EditButton>
          }
        />
        {editing && <BudgetDialog open onClose={() => setEditing(false)} />}
      </Card>
    );
  }

  const overall = summary;
  return (
    <Stack spacing={2.5}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <IconButton aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft size={18} />
          </IconButton>
          <Typography variant="h3" component="h2" sx={{ minWidth: 110, textAlign: 'center' }} aria-live="polite">
            {formatMonth(month)}
          </Typography>
          <IconButton aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= currentMonth}>
            <ChevronRight size={18} />
          </IconButton>
        </Stack>
        <EditButton variant="outlined" onClick={() => setEditing(true)}>
          Edit budget
        </EditButton>
      </Stack>

      <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' } }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Planned
            </Typography>
            <Typography variant="h2" component="p">
              <Money minor={overall.plannedMinor} />
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Spent
            </Typography>
            <Typography variant="h2" component="p">
              <Money minor={overall.actualMinor} />
            </Typography>
          </Box>
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
            <Typography variant="caption" color="text.secondary">
              {overall.remainingMinor >= 0 ? 'Remaining' : 'Over budget by'}
            </Typography>
            <Typography variant="h2" component="p" sx={(t) => ({ color: overall.remainingMinor < 0 ? t.tokens.errorText : undefined })}>
              <Money minor={Math.abs(overall.remainingMinor)} />
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, overall.percentUsed)}
            color={overall.state === 'over' ? 'error' : overall.state === 'warning' ? 'warning' : 'primary'}
            sx={{ flex: 1 }}
            aria-label={`${overall.percentUsed}% of the monthly budget used`}
          />
          <StatusChip tone={STATE_TONE[overall.state]} label={`${overall.percentUsed}% · ${STATE_LABEL[overall.state]}`} />
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          {budget.overallMinor === undefined ? 'Planned total is the sum of category limits. ' : ''}
          Warning shown at {budget.warningPercent}% of a limit. Only recorded expenses are counted.
        </Typography>
      </Card>

      {overall.categories.length > 0 && (
        <SectionCard title="Category budgets" flush>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {overall.categories.map((entry) => (
              <Box component="li" key={entry.category} sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1} sx={{ mb: 0.75 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {entry.category}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                    <Money minor={entry.actualMinor} /> of <Money minor={entry.limitMinor} />
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, entry.percentUsed)}
                  color={entry.state === 'over' ? 'error' : entry.state === 'warning' ? 'warning' : 'primary'}
                  aria-label={`${entry.category}: ${entry.percentUsed}% used`}
                />
                <Typography
                  variant="caption"
                  component="p"
                  sx={(t) => ({
                    mt: 0.5,
                    fontWeight: entry.state === 'ok' ? 400 : 600,
                    color: entry.state === 'over' ? t.tokens.errorText : entry.state === 'warning' ? t.tokens.amberText : t.tokens.textSecondary,
                  })}
                >
                  {entry.state === 'over'
                    ? `Over by ${formatMoney(-entry.remainingMinor)}`
                    : entry.state === 'warning'
                      ? `${entry.percentUsed}% used — nearing limit`
                      : `${entry.percentUsed}% used · ${formatMoney(entry.remainingMinor)} left`}
                </Typography>
              </Box>
            ))}
          </Box>
        </SectionCard>
      )}

      {overall.unbudgeted.length > 0 && (
        <SectionCard title="Spending without a category limit" subtitle="Counted in the overall budget" flush>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {overall.unbudgeted.map((entry) => (
              <Stack component="li" key={entry.category} direction="row" justifyContent="space-between" sx={{ px: 2.5, py: 1.25, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="body2">{entry.category}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  <Money minor={entry.actualMinor} />
                </Typography>
              </Stack>
            ))}
          </Box>
        </SectionCard>
      )}

      <SectionCard title="Last 6 months" subtitle="Actual spending compared with the planned budget">
        <ChartFigure
          height={240}
          summary={`Spending over the six months to ${formatMonth(month)}: ${trend.map((point) => `${formatMonth(point.month)} ${formatMoney(point.actual)}`).join(', ')}. Planned budget ${formatMoney(overall.plannedMinor)} per month.`}
          table={{
            columns: ['Month', 'Spent', 'Planned'],
            rows: trend.map((point) => [formatMonth(point.month), formatMoney(point.actual), formatMoney(point.planned)]),
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend.map((point) => ({ ...point, actualMajor: toMajor(point.actual, currency), plannedMajor: toMajor(point.planned, currency) }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={56}
                tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                tickFormatter={axisMoney}
              />
              <Tooltip
                formatter={(_value, name, item) => [
                  formatMoney(name === 'Spent' ? (item.payload as { actual: number }).actual : (item.payload as { planned: number }).planned),
                  name,
                ]}
                contentStyle={{ borderRadius: 10, border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper }}
              />
              <Bar dataKey="actualMajor" name="Spent" fill={colors[0]} radius={[6, 6, 0, 0]} maxBarSize={36} isAnimationActive={false} />
              <Line dataKey="plannedMajor" name="Planned" stroke={colors[1]} strokeWidth={2} dot={{ r: 3 }} type="stepAfter" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartFigure>
      </SectionCard>

      {editing && <BudgetDialog open budget={budget} onClose={() => setEditing(false)} />}
    </Stack>
  );
}

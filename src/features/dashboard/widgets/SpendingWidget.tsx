import { useMemo, useState } from 'react';
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography, useTheme } from '@mui/material';
import { PieChart } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAppSelector, useCollection, useCurrency, useToday } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { spendingByMonth } from '@/features/finance/logic/spending';
import { addMonthsISO, formatMonth, monthKey } from '@/lib/dates';
import { formatMoney, minorUnitDigits, toMajor } from '@/lib/money';
import { useReducedMotion } from 'framer-motion';
import { chartOther, chartSeries, chartSeriesDark } from '@/theme/tokens';
import { paths } from '@/app/paths';
import { WidgetFooterLink } from './WidgetList';

const RANGES = [3, 6, 12] as const;
const MAX_SERIES = 5;
const OTHER = 'Other';

export function SpendingWidget() {
  const expenses = useCollection('expenses');
  const budget = useAppSelector((state) => Object.values(state.data.budgets)[0]);
  const currency = useCurrency();
  const today = useToday();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const reduceMotion = useReducedMotion();
  const [months, setMonths] = useState<(typeof RANGES)[number]>(6);

  // Colours follow categories, ranked over all recorded expenses, so changing the range never
  // repaints a category.
  const topCategories = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amountMinor);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_SERIES).map(([category]) => category);
  }, [expenses]);

  const currentMonth = monthKey(today);
  const fromMonth = monthKey(addMonthsISO(`${currentMonth}-01`, -(months - 1)));
  const rows = useMemo(() => spendingByMonth(expenses, fromMonth, currentMonth), [expenses, fromMonth, currentMonth]);
  const series = useMemo(() => {
    const present = new Set(rows.flatMap((row) => Object.keys(row.byCategory)));
    const named = topCategories.filter((category) => present.has(category));
    const hasOther = [...present].some((category) => !topCategories.includes(category));
    return hasOther ? [...named, OTHER] : named;
  }, [rows, topCategories]);

  const chartData = rows.map((row) => {
    const entry: Record<string, number | string> = { month: formatMonth(row.month).split(' ')[0]!, label: formatMonth(row.month) };
    for (const category of series) {
      const minor =
        category === OTHER
          ? Object.entries(row.byCategory).reduce((sum, [name, value]) => (topCategories.includes(name) ? sum : sum + value), 0)
          : (row.byCategory[category] ?? 0);
      entry[category] = toMajor(minor, currency);
    }
    return entry;
  });

  const total = rows.reduce((sum, row) => sum + row.totalMinor, 0);
  const thisMonth = rows[rows.length - 1]?.totalMinor ?? 0;
  const colours = dark ? chartSeriesDark : chartSeries;
  const colourFor = (category: string) =>
    category === OTHER ? (dark ? chartOther.dark : chartOther.light) : colours[topCategories.indexOf(category)] ?? colours[0]!;
  const peak = rows.reduce((best, row) => (row.totalMinor > best.totalMinor ? row : best), rows[0] ?? { month: currentMonth, totalMinor: 0 });
  const summary =
    total === 0
      ? 'No spending recorded in this period.'
      : `Spending over the last ${months} months totals ${formatMoney(total, currency)}. The highest month was ${formatMonth(peak.month)} at ${formatMoney(peak.totalMinor, currency)}. This month so far: ${formatMoney(thisMonth, currency)}.`;

  return (
    <SectionCard
      title="Household spending"
      subtitle="Recorded expenses by category"
      icon={<PieChart size={17} />}
      sx={{ height: '100%' }}
      action={
        <ToggleButtonGroup
          size="small"
          exclusive
          value={months}
          onChange={(_, value: (typeof RANGES)[number] | null) => value && setMonths(value)}
          aria-label="Date range"
        >
          {RANGES.map((range) => (
            <ToggleButton key={range} value={range} sx={{ px: 1.25, py: 0.25 }} aria-label={`Last ${range} months`}>
              {range}M
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      }
    >
      {total === 0 ? (
        <EmptyState compact icon={<PieChart size={20} />} title="No spending recorded yet" description="Record expenses or mark bills as paid to see trends here." />
      ) : (
        <>
          <Stack direction="row" spacing={4} sx={{ mb: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                This month
              </Typography>
              <Typography variant="h2" component="p">
                <Money minor={thisMonth} />
              </Typography>
            </Box>
            {budget?.overallMinor !== undefined && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Monthly budget
                </Typography>
                <Typography variant="h2" component="p" color="text.secondary">
                  <Money minor={budget.overallMinor} />
                </Typography>
              </Box>
            )}
            <Box>
              <Typography variant="caption" color="text.secondary">
                Last {months} months
              </Typography>
              <Typography variant="h2" component="p" color="text.secondary">
                <Money minor={total} />
              </Typography>
            </Box>
          </Stack>
          <Box role="img" aria-label={summary} sx={{ height: 240, ml: -1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={56}
                  tick={{ fill: theme.palette.text.secondary, fontSize: 12 }}
                  tickFormatter={(value: number) =>
                    new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
                  }
                />
                <Tooltip
                  cursor={{ fill: theme.palette.action.hover }}
                  contentStyle={{
                    background: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 10,
                    fontSize: 13,
                    color: theme.palette.text.primary,
                  }}
                  labelFormatter={(_, payload) => String(payload?.[0]?.payload?.label ?? '')}
                  formatter={(value: number, name: string) => [formatMoney(Math.round(value * 10 ** minorUnitDigits(currency)), currency), name]}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: theme.palette.text.secondary, paddingTop: 8 }} />
                {series.map((category, index) => (
                  <Bar
                    key={category}
                    dataKey={category}
                    stackId="spend"
                    fill={colourFor(category)}
                    stroke={theme.palette.background.paper}
                    strokeWidth={1}
                    maxBarSize={36}
                    radius={index === series.length - 1 ? [4, 4, 0, 0] : 0}
                    isAnimationActive={!reduceMotion}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {summary}
          </Typography>
        </>
      )}
      <WidgetFooterLink to={paths.reports()}>View detailed reports</WidgetFooterLink>
    </SectionCard>
  );
}

import { useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from '@mui/material';
import { BarChart3 } from 'lucide-react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useActiveHousehold, useAppSelector, useCollection, useCurrency, useHouseholdLoading, useMembers, useRecord, useToday } from '@/app/hooks';
import { paths } from '@/app/paths';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { DashboardChartSkeleton } from '@/components/ui/Skeletons';
import { Money, useFormatMoney } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { formatDate, formatMonth, monthKey } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrence';
import { sumMinor, toMajor } from '@/lib/money';
import {
  REPORT_RANGE_LABELS,
  contributionsByMember,
  expensesBetween,
  isReportRange,
  resolveRange,
  spendingByCategory,
  spendingByMonth,
  type ReportRange,
} from '../logic/spending';
import { budgetSummary } from '../logic/budget';
import { monthlyEquivalentMinor } from '../logic/bills';
import { computeBalances } from '../logic/settlement';
import { ChartFigure, useAxisMoney, useChartColors, useChartOtherColor } from '../components/ChartFigure';

const MAX_PIE_SLICES = 5;

export default function ReportsPage() {
  const loading = useHouseholdLoading();
  const expenses = useCollection('expenses');
  const bills = useCollection('bills');
  const settlements = useCollection('settlements');
  const household = useActiveHousehold();
  const budget = useRecord('budgets', household?.id);
  const members = useMembers();
  const users = useAppSelector((state) => state.data.users);
  const today = useToday();
  const currency = useCurrency();
  const formatMoney = useFormatMoney();
  const axisMoney = useAxisMoney();
  const colors = useChartColors();
  const otherColor = useChartOtherColor();
  const theme = useTheme();
  const [params, setParams] = useSearchParams();
  const rangeParam = params.get('range');
  const range: ReportRange = isReportRange(rangeParam) ? rangeParam : '6m';
  const period = resolveRange(range, today);

  const inRange = useMemo(() => expensesBetween(expenses, period.from, period.to), [expenses, period.from, period.to]);
  const byCategory = useMemo(() => spendingByCategory(expenses, period.from, period.to), [expenses, period.from, period.to]);
  const byMonth = useMemo(() => spendingByMonth(expenses, period.fromMonth, period.toMonth), [expenses, period.fromMonth, period.toMonth]);
  const contributions = useMemo(() => contributionsByMember(inRange), [inRange]);
  const balances = useMemo(() => computeBalances(expenses, settlements, members.map((member) => member.userId)), [expenses, settlements, members]);
  const total = sumMinor(inRange.map((expense) => expense.amountMinor));
  const recurring = bills.filter((bill) => bill.active && bill.recurrence).sort((a, b) => monthlyEquivalentMinor(b) - monthlyEquivalentMinor(a));
  const recurringTotal = sumMinor(recurring.map(monthlyEquivalentMinor));
  const currentBudget = budget ? budgetSummary(budget, expenses, monthKey(today)) : null;

  const pieData = useMemo(() => {
    const top = byCategory.slice(0, MAX_PIE_SLICES);
    const rest = byCategory.slice(MAX_PIE_SLICES);
    const rows = rest.length ? [...top, { category: 'Other categories', totalMinor: sumMinor(rest.map((row) => row.totalMinor)) }] : top;
    return rows.map((row) => ({ ...row, value: toMajor(row.totalMinor, currency) }));
  }, [byCategory, currency]);

  const setRange = (value: ReportRange) => {
    const next = new URLSearchParams(params);
    next.set('range', value);
    setParams(next, { replace: true });
  };

  const tooltipStyle = { borderRadius: 10, border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper };
  const axisTick = { fill: theme.palette.text.secondary, fontSize: 12 };
  const pct = (value: number) => (total > 0 ? `${Math.round((value * 100) / total)}%` : '0%');

  if (loading) {
    return (
      <Stack spacing={2}>
        <DashboardChartSkeleton />
        <DashboardChartSkeleton />
      </Stack>
    );
  }

  return (
    <Stack spacing={2.5}>
      <Box sx={{ overflowX: 'auto', mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 } }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={range}
          onChange={(_, value: ReportRange | null) => value && setRange(value)}
          aria-label="Report date range"
        >
          {(Object.keys(REPORT_RANGE_LABELS) as ReportRange[]).map((key) => (
            <ToggleButton key={key} value={key} sx={{ whiteSpace: 'nowrap' }}>
              {REPORT_RANGE_LABELS[key]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <Card sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' } }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Spent · {formatDate(period.from, 'd MMM')} – {formatDate(period.to, 'd MMM yyyy')}
            </Typography>
            <Typography variant="h2" component="p">
              <Money minor={total} />
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Monthly average
            </Typography>
            <Typography variant="h2" component="p">
              <Money minor={byMonth.length ? Math.round(total / byMonth.length) : 0} />
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Expenses recorded
            </Typography>
            <Typography variant="h2" component="p">
              {inRange.length}
            </Typography>
          </Box>
        </Box>
      </Card>

      {inRange.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={24} />}
            title="No expenses in this period"
            description="Reports are built only from expenses you record. Choose a longer range or record an expense."
            action={
              <Button component={RouterLink} to={paths.expenses()}>
                Go to expenses
              </Button>
            }
          />
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
          <SectionCard title="Spending by category">
            <ChartFigure
              height={220}
              summary={`Largest categories: ${byCategory.slice(0, 3).map((row) => `${row.category} ${formatMoney(row.totalMinor)} (${pct(row.totalMinor)})`).join(', ')}.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="category" innerRadius="55%" outerRadius="85%" paddingAngle={2} isAnimationActive={false}>
                    {pieData.map((row, index) => (
                      <Cell key={row.category} fill={index < MAX_PIE_SLICES ? colors[index] : otherColor} stroke={theme.palette.background.paper} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(_value, name, item) => [formatMoney((item.payload as { totalMinor: number }).totalMinor), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </ChartFigure>
            <Table size="small" aria-label="Spending by category" sx={{ mt: 1 }}>
              <TableBody>
                {byCategory.map((row, index) => (
                  <TableRow key={row.category}>
                    <TableCell sx={{ pl: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box aria-hidden sx={{ width: 10, height: 10, borderRadius: '3px', flexShrink: 0, bgcolor: index < MAX_PIE_SLICES ? colors[index] : otherColor }} />
                        <span>{row.category}</span>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{pct(row.totalMinor)}</TableCell>
                    <TableCell align="right" sx={{ pr: 0, fontWeight: 600 }}>
                      <Money minor={row.totalMinor} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Monthly spending">
            <ChartFigure
              height={260}
              summary={`Monthly totals: ${byMonth.map((row) => `${formatMonth(row.month)} ${formatMoney(row.totalMinor)}`).join(', ')}.`}
              table={{ columns: ['Month', 'Spent'], rows: byMonth.map((row) => [formatMonth(row.month), formatMoney(row.totalMinor)]) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth.map((row) => ({ ...row, label: formatMonth(row.month), value: toMajor(row.totalMinor, currency) }))} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={(value: string) => value.split(' ')[0] ?? value} />
                  <YAxis tickLine={false} axisLine={false} width={56} tick={axisTick} tickFormatter={axisMoney} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(_value, _name, item) => [formatMoney((item.payload as { totalMinor: number }).totalMinor), 'Spent']} />
                  <Bar dataKey="value" name="Spent" fill={colors[0]} radius={[6, 6, 0, 0]} maxBarSize={40} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartFigure>
          </SectionCard>

          {currentBudget && currentBudget.categories.length > 0 && (
            <SectionCard title="Budget vs actual" subtitle={formatMonth(monthKey(today))}>
              <ChartFigure
                height={Math.max(180, currentBudget.categories.length * 44)}
                summary={currentBudget.categories
                  .map((row) => `${row.category}: ${formatMoney(row.actualMinor)} of ${formatMoney(row.limitMinor)}`)
                  .join('; ')}
                table={{
                  columns: ['Category', 'Budget', 'Actual'],
                  rows: currentBudget.categories.map((row) => [row.category, formatMoney(row.limitMinor), formatMoney(row.actualMinor)]),
                }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={currentBudget.categories.map((row) => ({ ...row, budget: toMajor(row.limitMinor, currency), actual: toMajor(row.actualMinor, currency) }))}
                    margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                    <XAxis type="number" tickLine={false} axisLine={false} tick={axisTick} tickFormatter={axisMoney} />
                    <YAxis type="category" dataKey="category" width={110} tickLine={false} axisLine={false} tick={axisTick} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(_value, name, item) => {
                        const row = item.payload as { limitMinor: number; actualMinor: number };
                        return [formatMoney(name === 'Budget' ? row.limitMinor : row.actualMinor), name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="budget" name="Budget" fill={colors[3]} radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
                    <Bar dataKey="actual" name="Actual" fill={colors[0]} radius={[0, 4, 4, 0]} barSize={12} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFigure>
            </SectionCard>
          )}

          <SectionCard title="Who paid" subtitle="Amount each member paid in this period">
            <Stack spacing={1.5} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {contributions.map((row) => (
                <Box component="li" key={row.userId}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <MemberAvatar userId={row.userId} withName size={24} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      <Money minor={row.totalMinor} /> · {pct(row.totalMinor)}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={total > 0 ? (row.totalMinor * 100) / total : 0}
                    aria-label={`${users[row.userId]?.name ?? 'Member'} paid ${pct(row.totalMinor)} of spending`}
                  />
                </Box>
              ))}
            </Stack>
          </SectionCard>
        </Box>
      )}

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'repeat(2, minmax(0, 1fr))' } }}>
        <SectionCard title="Recurring commitments" subtitle={<>≈ <Money minor={recurringTotal} /> per month across active bills</>} flush>
          {recurring.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2.5 }}>
              No active recurring bills.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Recurring commitments">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ pl: 2.5 }}>Bill</TableCell>
                    <TableCell>Schedule</TableCell>
                    <TableCell align="right" sx={{ pr: 2.5 }}>
                      Per month
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recurring.map((bill) => (
                    <TableRow key={bill.id}>
                      <TableCell sx={{ pl: 2.5 }}>{bill.name}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {describeRecurrence(bill.recurrence)} · <Money minor={bill.amountMinor} />
                      </TableCell>
                      <TableCell align="right" sx={{ pr: 2.5, fontWeight: 600 }}>
                        <Money minor={monthlyEquivalentMinor(bill)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </SectionCard>

        <SectionCard
          title="Shared balances"
          subtitle="Current position from split expenses and settlements"
          action={
            <Button component={RouterLink} to={paths.balances()} size="small">
              Details
            </Button>
          }
        >
          <Stack spacing={1} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {Object.entries(balances)
              .sort((a, b) => b[1] - a[1])
              .map(([userId, amount]) => (
                <Stack component="li" key={userId} direction="row" justifyContent="space-between" alignItems="center">
                  <MemberAvatar userId={userId} withName size={24} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {amount === 0 ? 'Settled' : amount > 0 ? <>Is owed <Money minor={amount} /></> : <>Owes <Money minor={-amount} /></>}
                  </Typography>
                </Stack>
              ))}
          </Stack>
        </SectionCard>
      </Box>

      {inRange.length > 0 && (
        <SectionCard
          title="Expense history"
          subtitle={`Most recent of ${inRange.length} expenses in this period`}
          action={
            <Button component={RouterLink} to={paths.expenses()} size="small">
              View all
            </Button>
          }
          flush
        >
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Recent expenses">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ pl: 2.5 }}>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Category</TableCell>
                  <TableCell align="right" sx={{ pr: 2.5 }}>
                    Amount
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...inRange]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 12)
                  .map((expense) => (
                    <TableRow key={expense.id} hover>
                      <TableCell sx={{ pl: 2.5, whiteSpace: 'nowrap' }}>{formatDate(expense.date, 'd MMM')}</TableCell>
                      <TableCell>
                        <Typography
                          component={RouterLink}
                          to={paths.expense(expense.id)}
                          variant="body2"
                          sx={{ color: 'text.primary', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {expense.description}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>{expense.category}</TableCell>
                      <TableCell align="right" sx={{ pr: 2.5, fontWeight: 600 }}>
                        <Money minor={expense.amountMinor} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Box>
        </SectionCard>
      )}
    </Stack>
  );
}

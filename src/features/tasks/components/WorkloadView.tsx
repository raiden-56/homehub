import { useMemo } from 'react';
import { Box, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, useTheme } from '@mui/material';
import { Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Task } from '@/types/models';
import { useAppSelector, useMembers } from '@/app/hooks';
import { selectHouseholdTimeZone } from '@/store/selectors';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { isoDateInZone } from '@/lib/dates';
import { chartSeries, chartSeriesDark } from '@/theme/tokens';
import { computeWorkload } from '../logic';

const WINDOW_DAYS = 30;

/** Neutral overview of how chores are spread across the household — no rankings. */
export function WorkloadView({ tasks, today }: { tasks: Task[]; today: string }) {
  const members = useMembers();
  const timeZone = useAppSelector(selectHouseholdTimeZone);
  const theme = useTheme();
  const rows = useMemo(
    () =>
      computeWorkload(
        tasks,
        members.map((member) => member.userId),
        today,
        (timestamp) => isoDateInZone(timestamp, timeZone),
        WINDOW_DAYS,
      ),
    [tasks, members, today, timeZone],
  );
  const nameOf = (userId: string | null) =>
    userId === null ? 'Unassigned' : (members.find((member) => member.userId === userId)?.name ?? 'Former member');
  const chartData = rows.map((row) => ({
    name: nameOf(row.userId).split(' ')[0],
    Open: row.open,
    [`Done (${WINDOW_DAYS} days)`]: row.completedRecently,
  }));
  const totalOpen = rows.reduce((sum, row) => sum + row.open, 0);
  const totalDone = rows.reduce((sum, row) => sum + row.completedRecently, 0);
  const isDark = theme.palette.mode === 'dark';
  const series = isDark ? chartSeriesDark : chartSeries;
  const colors = [series[0], series[1]];

  if (totalOpen === 0 && totalDone === 0) {
    return (
      <SectionCard title="Shared workload" icon={<Users size={18} />}>
        <EmptyState compact icon={<Users size={20} />} title="No chores to compare yet" description="Once tasks are assigned and completed, you’ll see how they’re shared here." />
      </SectionCard>
    );
  }

  return (
    <Stack spacing={2}>
      <SectionCard
        title="Shared workload"
        subtitle={`Open tasks and tasks completed in the last ${WINDOW_DAYS} days`}
        icon={<Users size={18} />}
      >
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} id="workload-summary">
          Across the household there are {totalOpen} open task{totalOpen === 1 ? '' : 's'} and {totalDone} completed in the last {WINDOW_DAYS} days.
          This view is here to help balance chores — every contribution counts, including the ones that don’t show up as tasks.
        </Typography>
        <Box sx={{ height: 260 }} role="img" aria-labelledby="workload-summary">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: theme.palette.action.hover }}
                contentStyle={{ borderRadius: 10, border: `1px solid ${theme.palette.divider}`, background: theme.palette.background.paper }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Open" fill={colors[0]} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey={`Done (${WINDOW_DAYS} days)`} fill={colors[1]} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </SectionCard>

      <SectionCard title="By member" flush>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" aria-label="Tasks per member">
            <TableHead>
              <TableRow>
                <TableCell>Member</TableCell>
                <TableCell align="right">Open</TableCell>
                <TableCell align="right">Overdue</TableCell>
                <TableCell align="right">Done ({WINDOW_DAYS} days)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.userId ?? 'unassigned'}>
                  <TableCell>
                    {row.userId ? <MemberAvatar userId={row.userId} withName size={24} /> : <Typography variant="body2" color="text.secondary">Unassigned</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.open}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.overdue}</TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{row.completedRecently}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </SectionCard>
    </Stack>
  );
}

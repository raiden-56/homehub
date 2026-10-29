import { useMemo } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import type { Task } from '@/types/models';
import { useAppSelector } from '@/app/hooks';
import { buildCalendarEntries, type CalendarEntry } from '@/features/calendar/aggregate';
import { parseAnchor, rangeTitle, shiftAnchor, viewRange } from '@/features/calendar/range';
import { MonthView } from '@/features/calendar/components/MonthView';
import { DayList } from '@/features/calendar/components/DayList';

interface TaskCalendarViewProps {
  /** Already-filtered tasks to show. */
  tasks: Task[];
  today: string;
  linkFor: (taskId: string) => string;
  onAdd?: (date: string) => void;
}

/** Month grid of tasks by due date, reusing the household calendar's components. */
export function TaskCalendarView({ tasks, today, linkFor, onAdd }: TaskCalendarViewProps) {
  const [params, setParams] = useSearchParams();
  const anchor = parseAnchor(params.get('date'), today);
  const data = useAppSelector((state) => state.data);
  const { from, to } = viewRange('month', anchor);

  const entries = useMemo(() => {
    const visible = Object.fromEntries(tasks.map((task) => [task.id, task]));
    return buildCalendarEntries({ ...data, tasks: visible }, from, to, { sources: ['task'], today });
  }, [data, tasks, from, to, today]);

  const setDate = (date: string | null) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (date && date !== today) next.set('date', date);
        else next.delete('date');
        return next;
      },
      { replace: true },
    );

  const entryLink = (entry: CalendarEntry) => linkFor(entry.recordId);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <IconButton aria-label="Previous month" onClick={() => setDate(shiftAnchor('month', anchor, -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <Button variant="outlined" size="small" onClick={() => setDate(null)} disabled={anchor === today}>
          Today
        </Button>
        <IconButton aria-label="Next month" onClick={() => setDate(shiftAnchor('month', anchor, 1))}>
          <ChevronRight size={20} />
        </IconButton>
        <Typography variant="h2" component="h2" aria-live="polite" sx={{ ml: 1, fontSize: { xs: '1.125rem', sm: '1.375rem' } }}>
          {rangeTitle('month', anchor)}
        </Typography>
      </Stack>
      <MonthView
        anchor={anchor}
        today={today}
        entries={entries}
        selectedDate={anchor}
        onSelectDate={setDate}
        onAdd={onAdd}
        addLabel="Add task"
        linkFor={entryLink}
      />
      <DayList date={anchor} today={today} entries={entries} linkFor={entryLink} onAdd={onAdd} addLabel="Add task" />
    </Box>
  );
}

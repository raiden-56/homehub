import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { CalendarCheck, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { ISODate } from '@/types/models';
import { fromISODate, relativeDay } from '@/lib/dates';
import { EmptyState } from '@/components/ui/EmptyState';
import { groupByDay, type CalendarEntry } from '../aggregate';
import { AGENDA_DAYS, viewRange } from '../range';
import { EntryRow, type EntryLinkResolver } from './EntryItem';

interface AgendaViewProps {
  anchor: ISODate;
  today: ISODate;
  entries: CalendarEntry[];
  linkFor: EntryLinkResolver;
  onAdd?: (date: ISODate) => void;
}

/** Chronological list of the next 60 days, grouped by day. */
export function AgendaView({ anchor, today, entries, linkFor, onAdd }: AgendaViewProps) {
  const { from, to } = viewRange('agenda', anchor);
  const byDay = [...groupByDay(entries, from, to).entries()].sort(([a], [b]) => a.localeCompare(b));

  if (byDay.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarCheck size={24} />}
          title="Nothing scheduled"
          description={`There’s nothing on the calendar for the next ${AGENDA_DAYS} days with the current filters.`}
          action={
            onAdd ? (
              <Button variant="contained" startIcon={<Plus size={16} />} onClick={() => onAdd(anchor)}>
                Create event
              </Button>
            ) : undefined
          }
        />
      </Card>
    );
  }

  return (
    <Card>
      {byDay.map(([date, dayEntries], index) => {
        const relative = relativeDay(date, today);
        const named = ['Today', 'Tomorrow', 'Yesterday'].includes(relative);
        return (
          <Box key={date} component="section" sx={{ borderTop: index === 0 ? 0 : 1, borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} alignItems="baseline" sx={{ px: 2, pt: 1.75, pb: 0.5 }}>
              <Typography variant="h4" component="h3" color={date === today ? 'primary' : 'text.primary'}>
                {named ? relative : format(fromISODate(date), 'EEEE')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {format(fromISODate(date), named ? 'EEEE d MMMM' : 'd MMMM yyyy')}
              </Typography>
            </Stack>
            <Stack sx={{ px: 0.5, pb: 1 }}>
              {dayEntries.map((entry) => (
                <EntryRow key={`${date}-${entry.key}`} entry={entry} linkFor={linkFor} />
              ))}
            </Stack>
          </Box>
        );
      })}
    </Card>
  );
}

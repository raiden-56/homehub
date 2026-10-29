import { Box, Card, IconButton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { ISODate } from '@/types/models';
import { addDaysISO, fromISODate } from '@/lib/dates';
import { groupByDay, type CalendarEntry } from '../aggregate';
import { viewRange } from '../range';
import { EntryChip, EntryRow, type EntryLinkResolver } from './EntryItem';

interface WeekViewProps {
  anchor: ISODate;
  today: ISODate;
  entries: CalendarEntry[];
  linkFor: EntryLinkResolver;
  onAdd?: (date: ISODate) => void;
}

/** Seven columns on desktop; stacked days on smaller screens. */
export function WeekView({ anchor, today, entries, linkFor, onAdd }: WeekViewProps) {
  const theme = useTheme();
  const stacked = useMediaQuery(theme.breakpoints.down('md'));
  const { from, to } = viewRange('week', anchor);
  const byDay = groupByDay(entries, from, to);
  const days = Array.from({ length: 7 }, (_, index) => addDaysISO(from, index));

  if (stacked) {
    return (
      <Stack spacing={1.5}>
        {days.map((date) => {
          const dayEntries = byDay.get(date) ?? [];
          return (
            <Card key={date} component="section" aria-label={format(fromISODate(date), 'EEEE d MMMM')}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
                <Typography variant="h4" component="h3" color={date === today ? 'primary' : 'text.primary'}>
                  {format(fromISODate(date), 'EEE d MMM')}
                  {date === today ? ' · Today' : ''}
                </Typography>
                {onAdd && (
                  <IconButton aria-label={`Add event on ${format(fromISODate(date), 'd MMMM')}`} onClick={() => onAdd(date)}>
                    <Plus size={18} />
                  </IconButton>
                )}
              </Stack>
              {dayEntries.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ px: 2, pb: 1.5 }}>
                  Nothing scheduled
                </Typography>
              ) : (
                <Stack sx={{ px: 0.5, pb: 1 }}>
                  {dayEntries.map((entry) => (
                    <EntryRow key={entry.key} entry={entry} linkFor={linkFor} />
                  ))}
                </Stack>
              )}
            </Card>
          );
        })}
      </Stack>
    );
  }

  return (
    <Card sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
      {days.map((date, index) => {
        const dayEntries = byDay.get(date) ?? [];
        const isToday = date === today;
        return (
          <Box
            key={date}
            component="section"
            aria-label={`${format(fromISODate(date), 'EEEE d MMMM')}, ${dayEntries.length} items`}
            sx={{ borderLeft: index === 0 ? 0 : 1, borderColor: 'divider', minHeight: 360, minWidth: 0 }}
          >
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={(t) => ({ px: 1.25, py: 1, borderBottom: 1, borderColor: 'divider', backgroundColor: isToday ? t.tokens.sage : undefined })}
            >
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block' }}>
                  {format(fromISODate(date), 'EEE')}
                </Typography>
                <Typography variant="h3" component="h3" sx={{ color: isToday ? 'primary.main' : 'text.primary' }}>
                  {format(fromISODate(date), 'd')}
                </Typography>
              </Box>
              {onAdd && (
                <Tooltip title="Add event">
                  <IconButton size="small" aria-label={`Add event on ${format(fromISODate(date), 'd MMMM')}`} onClick={() => onAdd(date)}>
                    <Plus size={14} />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Stack spacing={0.5} sx={{ p: 0.75 }}>
              {dayEntries.map((entry) => (
                <EntryChip key={entry.key} entry={entry} linkFor={linkFor} />
              ))}
            </Stack>
          </Box>
        );
      })}
    </Card>
  );
}

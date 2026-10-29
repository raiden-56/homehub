import { Box, ButtonBase, Card, IconButton, Stack, Tooltip, Typography, useMediaQuery, useTheme } from '@mui/material';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { ISODate } from '@/types/models';
import { fromISODate } from '@/lib/dates';
import { groupByDay, type CalendarEntry } from '../aggregate';
import { WEEKDAY_LABELS, monthGrid, viewRange } from '../range';
import { EntryChip, EntryDot, type EntryLinkResolver } from './EntryItem';

interface MonthViewProps {
  anchor: ISODate;
  today: ISODate;
  entries: CalendarEntry[];
  selectedDate: ISODate;
  onSelectDate: (date: ISODate) => void;
  /** Present when the member may add items; called with the clicked day. */
  onAdd?: (date: ISODate) => void;
  addLabel?: string;
  linkFor: EntryLinkResolver;
}

const MAX_CHIPS = 3;

export function MonthView({ anchor, today, entries, selectedDate, onSelectDate, onAdd, addLabel = 'Add event', linkFor }: MonthViewProps) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('sm'));
  const weeks = monthGrid(anchor);
  const { from, to } = viewRange('month', anchor);
  const byDay = groupByDay(entries, from, to);
  const month = anchor.slice(0, 7);

  return (
    <Card sx={{ p: { xs: 1, sm: 1.5 } }}>
      <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', mb: 0.5 }}>
        {WEEKDAY_LABELS.map((day) => (
          <Typography key={day} variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 700, py: 0.5 }}>
            {compact ? day.slice(0, 1) : day.slice(0, 3)}
          </Typography>
        ))}
      </Box>
      <Box role="list" aria-label={`${format(fromISODate(anchor), 'MMMM yyyy')} calendar`} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: { xs: 0.5, sm: 0.75 } }}>
        {weeks.flat().map((date) => {
          const dayEntries = byDay.get(date) ?? [];
          const inMonth = date.slice(0, 7) === month;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const dayLabel = `${format(fromISODate(date), 'EEEE d MMMM')}${isToday ? ', today' : ''}, ${dayEntries.length === 0 ? 'nothing scheduled' : `${dayEntries.length} item${dayEntries.length === 1 ? '' : 's'}`}`;
          return (
            <Box
              key={date}
              role="listitem"
              sx={(t) => ({
                position: 'relative',
                minHeight: { xs: 52, sm: 92, md: 108 },
                borderRadius: 2,
                border: 1,
                borderColor: isSelected ? t.palette.primary.main : t.palette.divider,
                backgroundColor: isSelected ? t.tokens.sage : inMonth ? t.palette.background.paper : t.tokens.surfaceMuted,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                '&:hover .add-button, &:focus-within .add-button': { opacity: 1 },
              })}
            >
              <ButtonBase
                onClick={() => onSelectDate(date)}
                aria-label={dayLabel}
                aria-pressed={isSelected}
                sx={{
                  position: compact ? 'absolute' : 'relative',
                  inset: compact ? 0 : undefined,
                  alignSelf: 'flex-start',
                  borderRadius: 2,
                  m: compact ? 0 : 0.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: compact ? 'flex-start' : 'center',
                  pt: compact ? 0.5 : 0,
                  minWidth: 28,
                  minHeight: 28,
                }}
              >
                <Box
                  component="span"
                  sx={(t) => ({
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.8125rem',
                    fontWeight: isToday ? 800 : 600,
                    backgroundColor: isToday ? t.palette.primary.main : 'transparent',
                    color: isToday ? t.palette.primary.contrastText : inMonth ? t.palette.text.primary : t.palette.text.secondary,
                  })}
                >
                  {Number(date.slice(8))}
                </Box>
                {compact && dayEntries.length > 0 && (
                  <Stack direction="row" spacing={0.375} sx={{ mt: 0.5 }}>
                    {dayEntries.slice(0, 3).map((entry) => (
                      <EntryDot key={entry.key} entry={entry} />
                    ))}
                  </Stack>
                )}
              </ButtonBase>
              {!compact && onAdd && (
                <Tooltip title={addLabel}>
                  <IconButton
                    className="add-button"
                    size="small"
                    aria-label={`${addLabel} on ${format(fromISODate(date), 'd MMMM')}`}
                    onClick={() => onAdd(date)}
                    sx={{ position: 'absolute', top: 4, right: 4, opacity: 0, width: 28, height: 28, transition: 'opacity 120ms ease' }}
                  >
                    <Plus size={14} />
                  </IconButton>
                </Tooltip>
              )}
              {!compact && (
                <Stack spacing={0.375} sx={{ px: 0.5, pb: 0.5, minWidth: 0 }}>
                  {dayEntries.slice(0, MAX_CHIPS).map((entry) => (
                    <EntryChip key={entry.key} entry={entry} linkFor={linkFor} />
                  ))}
                  {dayEntries.length > MAX_CHIPS && (
                    <ButtonBase
                      onClick={() => onSelectDate(date)}
                      sx={{ justifyContent: 'flex-start', px: 0.75, borderRadius: 1, fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}
                    >
                      +{dayEntries.length - MAX_CHIPS} more
                    </ButtonBase>
                  )}
                </Stack>
              )}
            </Box>
          );
        })}
      </Box>
    </Card>
  );
}

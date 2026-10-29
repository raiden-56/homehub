import { useCallback, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan, useHouseholdLoading, useMembers, useToday } from '@/app/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import { CalendarSkeleton } from '@/components/ui/Skeletons';
import { paths } from '@/app/paths';
import { useCalendarEntries, type CalendarEntry } from './aggregate';
import { CALENDAR_SOURCES, SOURCE_INFO, type CalendarSource } from './sources';
import { parseAnchor, parseView, rangeTitle, shiftAnchor, viewRange, type CalendarView } from './range';
import { MonthView } from './components/MonthView';
import { WeekView } from './components/WeekView';
import { AgendaView } from './components/AgendaView';
import { DayList } from './components/DayList';
import { EventDialog } from './components/EventDialog';
import { EventDetailDrawer } from './components/EventDetailDrawer';

export default function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const today = useToday();
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const members = useMembers();
  const [addDate, setAddDate] = useState<string | null>(null);

  const view = parseView(searchParams.get('view'));
  const anchor = parseAnchor(searchParams.get('date'), today);
  const sourceParam = searchParams.get('sources');
  const sources = sourceParam
    ? (sourceParam.split(',').filter((value) => (CALENDAR_SOURCES as string[]).includes(value)) as CalendarSource[])
    : CALENDAR_SOURCES;
  const memberId = searchParams.get('member') ?? '';
  const { from, to } = viewRange(view, anchor);
  const entries = useCalendarEntries(from, to, { sources, memberId: memberId || undefined });

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const toggleSource = (source: CalendarSource) => {
    const next = sources.includes(source) ? sources.filter((value) => value !== source) : [...sources, source];
    const ordered = CALENDAR_SOURCES.filter((value) => next.includes(value));
    update({ sources: ordered.length === CALENDAR_SOURCES.length ? null : ordered.length === 0 ? 'none' : ordered.join(',') });
  };

  const search = location.search;
  const linkFor = (entry: CalendarEntry) => (entry.source === 'event' ? `${paths.calendarEvent(entry.recordId)}${search}` : entry.to);
  const onAdd = canEdit ? (date: string) => setAddDate(date) : undefined;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Household events together with chores, bills and maintenance — each shown from its original record."
        actions={
          <Tooltip title={canEdit ? '' : 'Viewers can’t create events'}>
            <span>
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAddDate(anchor)} disabled={!canEdit}>
                New event
              </Button>
            </span>
          </Tooltip>
        }
      />

      <Stack spacing={1.5} sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
            <IconButton aria-label={`Previous ${view === 'agenda' ? 'period' : view}`} onClick={() => update({ date: shiftAnchor(view, anchor, -1) })}>
              <ChevronLeft size={20} />
            </IconButton>
            <Button variant="outlined" size="small" onClick={() => update({ date: null })} disabled={anchor === today}>
              Today
            </Button>
            <IconButton aria-label={`Next ${view === 'agenda' ? 'period' : view}`} onClick={() => update({ date: shiftAnchor(view, anchor, 1) })}>
              <ChevronRight size={20} />
            </IconButton>
            <Typography variant="h2" component="h2" aria-live="polite" sx={{ ml: 1, fontSize: { xs: '1.125rem', sm: '1.375rem' } }} noWrap>
              {rangeTitle(view, anchor)}
            </Typography>
          </Stack>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_, value: CalendarView | null) => value && update({ view: value === 'month' ? null : value })}
            aria-label="Calendar view"
          >
            <ToggleButton value="month">Month</ToggleButton>
            <ToggleButton value="week">Week</ToggleButton>
            <ToggleButton value="agenda">Agenda</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, flex: 1 }} role="group" aria-label="Show on calendar">
            {CALENDAR_SOURCES.map((source) => {
              const Icon = SOURCE_INFO[source].icon;
              const active = sources.includes(source);
              return (
                <Chip
                  key={source}
                  icon={<Icon size={14} />}
                  label={SOURCE_INFO[source].plural}
                  onClick={() => toggleSource(source)}
                  aria-pressed={active}
                  color={active ? 'primary' : 'default'}
                  variant={active ? 'filled' : 'outlined'}
                  sx={{ height: 34 }}
                />
              );
            })}
          </Stack>
          <TextField
            select
            label="Member"
            value={memberId}
            onChange={(event) => update({ member: event.target.value || null })}
            sx={{ width: { xs: '100%', sm: 200 } }}
          >
            <MenuItem value="">Everyone</MenuItem>
            {members.map((member) => (
              <MenuItem key={member.userId} value={member.userId}>
                {member.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>

      {loading ? (
        <CalendarSkeleton />
      ) : view === 'month' ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <MonthView
            anchor={anchor}
            today={today}
            entries={entries}
            selectedDate={anchor}
            onSelectDate={(date) => update({ date: date === today ? null : date })}
            onAdd={onAdd}
            linkFor={linkFor}
          />
          <DayList date={anchor} today={today} entries={entries} linkFor={linkFor} onAdd={onAdd} />
        </Box>
      ) : view === 'week' ? (
        <WeekView anchor={anchor} today={today} entries={entries} linkFor={linkFor} onAdd={onAdd} />
      ) : (
        <AgendaView anchor={anchor} today={today} entries={entries} linkFor={linkFor} onAdd={onAdd} />
      )}

      <EventDialog open={addDate !== null} onClose={() => setAddDate(null)} defaultDate={addDate ?? undefined} />
      <EventDetailDrawer eventId={eventId} onClose={() => navigate(`${paths.calendar()}${search}`)} />
    </>
  );
}

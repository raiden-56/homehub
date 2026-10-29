import { Button, Stack } from '@mui/material';
import { CalendarCheck, Plus } from 'lucide-react';
import { format } from 'date-fns';
import type { ISODate } from '@/types/models';
import { fromISODate, relativeDay } from '@/lib/dates';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { entriesOn, type CalendarEntry } from '../aggregate';
import { EntryRow, type EntryLinkResolver } from './EntryItem';

interface DayListProps {
  date: ISODate;
  today: ISODate;
  entries: CalendarEntry[];
  linkFor: EntryLinkResolver;
  onAdd?: (date: ISODate) => void;
  addLabel?: string;
}

/** Everything scheduled on one day (used below the month grid). */
export function DayList({ date, today, entries, linkFor, onAdd, addLabel = 'Add event' }: DayListProps) {
  const dayEntries = entriesOn(entries, date);
  const relative = relativeDay(date, today);
  const heading = format(fromISODate(date), 'EEEE d MMMM');
  return (
    <SectionCard
      title={['Today', 'Tomorrow', 'Yesterday'].includes(relative) ? `${relative} · ${heading}` : heading}
      subtitle={dayEntries.length === 0 ? 'Nothing scheduled' : `${dayEntries.length} item${dayEntries.length === 1 ? '' : 's'}`}
      action={
        onAdd ? (
          <Button size="small" startIcon={<Plus size={16} />} onClick={() => onAdd(date)}>
            {addLabel}
          </Button>
        ) : undefined
      }
      flush
    >
      {dayEntries.length === 0 ? (
        <EmptyState compact icon={<CalendarCheck size={20} />} title="A free day" description="Nothing is scheduled for this day." />
      ) : (
        <Stack sx={{ px: 1, pb: 1 }} aria-live="polite">
          {dayEntries.map((entry) => (
            <EntryRow key={entry.key} entry={entry} linkFor={linkFor} />
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

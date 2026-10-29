import { useState } from 'react';
import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { Pencil, Trash2 } from 'lucide-react';
import { useCan, useCommit, useRecord } from '@/app/hooks';
import { DetailDrawer, DetailRow } from '@/components/ui/DetailDrawer';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusChip } from '@/components/ui/StatusChip';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { formatDate, formatTime, formatTimestamp } from '@/lib/dates';
import { describeRecurrence } from '@/lib/recurrence';
import { reminderLabel } from '@/features/tasks/logic';
import { EVENT_CATEGORY_LABELS } from '../sources';
import { EventDialog } from './EventDialog';

interface EventDetailDrawerProps {
  eventId: string | undefined;
  onClose: () => void;
}

export function EventDetailDrawer({ eventId, onClose }: EventDetailDrawerProps) {
  const event = useRecord('events', eventId);
  const canEdit = useCan('edit');
  const commit = useCommit();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);

  const remove = async () => {
    if (!event) return;
    const ok = await confirm({
      title: `Delete “${event.title}”?`,
      description: event.recurrence
        ? 'This is a repeating event. Deleting it removes every occurrence in the series.'
        : 'The event will be removed from the household calendar.',
      confirmLabel: event.recurrence ? 'Delete series' : 'Delete event',
      destructive: true,
    });
    if (!ok) return;
    const deleted = await commit(
      { remove: { events: [event.id] } },
      {
        activity: { entity: 'event', entityId: event.id, message: `Deleted the event “${event.title}”` },
        success: 'Event deleted',
        undo: { put: { events: [event] } },
      },
    );
    if (deleted) onClose();
  };

  const when = event
    ? [
        formatDate(event.date, 'EEE d MMM yyyy'),
        event.endDate ? `– ${formatDate(event.endDate, 'EEE d MMM yyyy')}` : undefined,
        event.allDay || !event.startTime
          ? 'All day'
          : `${formatTime(event.startTime)}${event.endTime ? ` – ${formatTime(event.endTime)}` : ''}`,
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  return (
    <>
      <DetailDrawer
        open={!!eventId}
        onClose={onClose}
        title={event?.title ?? 'Event'}
        subtitle={event ? when : undefined}
        actions={
          event ? (
            <Tooltip title={canEdit ? 'Edit event' : 'Viewers can’t edit events'}>
              <span>
                <Button size="small" startIcon={<Pencil size={16} />} onClick={() => setEditing(true)} disabled={!canEdit}>
                  Edit
                </Button>
              </span>
            </Tooltip>
          ) : undefined
        }
      >
        {!event ? (
          <ErrorState kind="not-found" title="Event not found" description="It may have been deleted, or it belongs to another household." />
        ) : (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <StatusChip tone="primary" label={EVENT_CATEGORY_LABELS[event.category]} />
              {event.recurrence && <StatusChip tone="neutral" label={describeRecurrence(event.recurrence)} />}
            </Stack>
            <Box>
              <DetailRow label="When">{when}</DetailRow>
              {event.location && <DetailRow label="Location">{event.location}</DetailRow>}
              <DetailRow label="Repeats">{describeRecurrence(event.recurrence)}</DetailRow>
              <DetailRow label="Reminder">
                {event.reminderMinutesBefore !== undefined ? `${reminderLabel(event.reminderMinutesBefore)} (in-app)` : 'None'}
              </DetailRow>
              <DetailRow label="Who">
                {event.memberIds.length === 0 ? (
                  'Whole household'
                ) : (
                  <Stack spacing={0.75}>
                    {event.memberIds.map((id) => (
                      <MemberAvatar key={id} userId={id} withName size={24} />
                    ))}
                  </Stack>
                )}
              </DetailRow>
              <DetailRow label="Added by">
                <MemberAvatar userId={event.createdBy} withName size={24} />
              </DetailRow>
              <DetailRow label="Last updated">{formatTimestamp(event.updatedAt)}</DetailRow>
            </Box>
            {event.description && (
              <Box>
                <Typography variant="subtitle2" component="h3" sx={{ mb: 0.5 }}>
                  Notes
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {event.description}
                </Typography>
              </Box>
            )}
            {canEdit && (
              <Box>
                <Button color="error" startIcon={<Trash2 size={16} />} onClick={remove}>
                  {event.recurrence ? 'Delete series' : 'Delete event'}
                </Button>
              </Box>
            )}
          </Stack>
        )}
      </DetailDrawer>
      {event && <EventDialog open={editing} onClose={() => setEditing(false)} event={event} />}
    </>
  );
}

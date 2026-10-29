import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { StatusChip } from '@/components/ui/StatusChip';
import { MemberAvatarGroup } from '@/components/ui/MemberAvatar';
import { formatShortDate, formatTime } from '@/lib/dates';
import type { CalendarEntry } from '../aggregate';
import { SOURCE_INFO, sourceColors } from '../sources';

export type EntryLinkResolver = (entry: CalendarEntry) => string;

function timeLabel(entry: CalendarEntry): string {
  if (entry.endDate) return `${formatShortDate(entry.date)} – ${formatShortDate(entry.endDate)}`;
  if (entry.allDay || !entry.time) return 'All day';
  return entry.endTime ? `${formatTime(entry.time)} – ${formatTime(entry.endTime)}` : formatTime(entry.time);
}

function accessibleLabel(entry: CalendarEntry): string {
  return [SOURCE_INFO[entry.source].label, entry.title, timeLabel(entry), entry.statusLabel].filter(Boolean).join(', ');
}

/** Compact bar used inside month-grid cells. */
export function EntryChip({ entry, linkFor }: { entry: CalendarEntry; linkFor: EntryLinkResolver }) {
  const Icon = SOURCE_INFO[entry.source].icon;
  return (
    <ButtonBase
      component={RouterLink}
      to={linkFor(entry)}
      aria-label={accessibleLabel(entry)}
      onClick={(event) => event.stopPropagation()}
      sx={(theme) => {
        const colors = sourceColors(theme.tokens)[entry.source];
        return {
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          width: '100%',
          minWidth: 0,
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          justifyContent: 'flex-start',
          backgroundColor: colors.soft,
          color: colors.text,
          borderLeft: `3px solid ${colors.accent}`,
          fontSize: '0.75rem',
          fontWeight: 600,
          textDecoration: entry.done ? 'line-through' : 'none',
          opacity: entry.done ? 0.7 : 1,
          '&:hover': { filter: 'brightness(0.97)' },
          '&.Mui-focusVisible': { outline: `2px solid ${theme.tokens.focus}`, outlineOffset: 1 },
        };
      }}
    >
      <Icon size={12} aria-hidden style={{ flexShrink: 0 }} />
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.time && !entry.allDay ? `${formatTime(entry.time).replace(':00', '')} ` : ''}
        {entry.title}
      </Box>
    </ButtonBase>
  );
}

/** Full row used in agenda, week and day lists. */
export function EntryRow({ entry, linkFor, showDate }: { entry: CalendarEntry; linkFor: EntryLinkResolver; showDate?: boolean }) {
  const info = SOURCE_INFO[entry.source];
  const Icon = info.icon;
  return (
    <ButtonBase
      component={RouterLink}
      to={linkFor(entry)}
      aria-label={accessibleLabel(entry)}
      sx={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        justifyContent: 'flex-start',
        textAlign: 'left',
        gap: 1.5,
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        minHeight: 48,
        '&:hover': { bgcolor: 'action.hover' },
        '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' },
      }}
    >
      <Box
        aria-hidden
        sx={(theme) => {
          const colors = sourceColors(theme.tokens)[entry.source];
          return {
            width: 34,
            height: 34,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            backgroundColor: colors.soft,
            color: colors.text,
          };
        }}
      >
        <Icon size={16} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 600, textDecoration: entry.done ? 'line-through' : 'none', color: entry.done ? 'text.secondary' : 'text.primary' }}
          noWrap
        >
          {entry.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" component="p" noWrap>
          {[showDate && !entry.endDate ? formatShortDate(entry.date) : undefined, timeLabel(entry), info.label, entry.category, entry.location]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
        {entry.statusLabel && (
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <StatusChip tone={entry.tone} label={entry.statusLabel} />
          </Box>
        )}
        {entry.memberIds.length > 0 && <MemberAvatarGroup userIds={entry.memberIds} max={3} size={24} />}
      </Stack>
    </ButtonBase>
  );
}

/** Small coloured dot for compact mobile month cells (the day's list below gives the details). */
export function EntryDot({ entry }: { entry: CalendarEntry }) {
  return (
    <Box
      aria-hidden
      sx={(theme) => ({
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: sourceColors(theme.tokens)[entry.source].accent,
      })}
    />
  );
}

import { useEffect, useState } from 'react';
import { Alert, Box, FormControlLabel, InputAdornment, Stack, Switch, TextField, Typography } from '@mui/material';
import { Bell, Clock } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { NOTIFICATION_CATEGORY_LABELS } from '@/features/notifications/derive';
import type { NotificationCategory, NotificationPreferences } from '@/types/models';
import { usePreferenceUpdater } from './AppearanceSection';

const LEAD_FIELDS: { key: keyof Pick<NotificationPreferences, 'billLeadDays' | 'expiryLeadDays' | 'maintenanceLeadDays' | 'warrantyLeadDays'>; label: string; help: string; max: number }[] = [
  { key: 'billLeadDays', label: 'Bills due soon', help: 'Mark bills as “due soon” this many days ahead.', max: 60 },
  { key: 'expiryLeadDays', label: 'Expiring products', help: 'Warn about pantry items expiring within this window.', max: 60 },
  { key: 'maintenanceLeadDays', label: 'Upcoming maintenance', help: 'Remind about service tasks this many days ahead.', max: 90 },
  { key: 'warrantyLeadDays', label: 'Warranty expiry', help: 'Warn before appliance warranties end.', max: 365 },
];

function LeadDaysField({ label, help, value, max, onCommit }: { label: string; help: string; value: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const parsed = Number(draft);
  const invalid = !Number.isInteger(parsed) || parsed < 0 || parsed > max;
  return (
    <TextField
      label={label}
      type="number"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (!invalid && parsed !== value) onCommit(parsed);
      }}
      error={invalid}
      helperText={invalid ? `Enter a whole number from 0 to ${max}` : help}
      slotProps={{
        htmlInput: { min: 0, max, inputMode: 'numeric' },
        input: { endAdornment: <InputAdornment position="end">days</InputAdornment> },
      }}
    />
  );
}

export function NotificationsSection() {
  const { preferences, update } = usePreferenceUpdater();
  if (!preferences) return null;
  const notifications = preferences.notifications;

  const setEnabled = (category: NotificationCategory, enabled: boolean) =>
    update({ notifications: { ...notifications, enabled: { ...notifications.enabled, [category]: enabled } } });

  return (
    <>
      <SectionCard title="In-app notifications" icon={<Bell size={17} />}>
        <Alert severity="info" sx={{ mb: 2 }}>
          Notifications appear inside HomeHub (the bell in the header). In local mode HomeHub does not send push, email or
          SMS notifications.
        </Alert>
        <Box sx={{ display: 'grid', gap: 0.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
          {(Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[]).map((category) => (
            <FormControlLabel
              key={category}
              control={<Switch checked={notifications.enabled[category]} onChange={(event) => setEnabled(category, event.target.checked)} />}
              label={NOTIFICATION_CATEGORY_LABELS[category]}
            />
          ))}
        </Box>
      </SectionCard>
      <SectionCard title="Reminder timing" icon={<Clock size={17} />}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          These windows also control “due soon” and “expiring soon” labels across HomeHub. Changes save when you leave a field.
        </Typography>
        <Stack spacing={2} sx={{ maxWidth: 420 }}>
          {LEAD_FIELDS.map((field) => (
            <LeadDaysField
              key={field.key}
              label={field.label}
              help={field.help}
              max={field.max}
              value={notifications[field.key]}
              onCommit={(value) => update({ notifications: { ...notifications, [field.key]: value } }, 'Reminder timing saved')}
            />
          ))}
        </Stack>
      </SectionCard>
    </>
  );
}

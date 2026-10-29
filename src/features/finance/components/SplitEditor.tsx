import {
  Box,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useCurrency, useMembers } from '@/app/hooks';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { formatMoney } from '@/lib/money';
import type { Minor, SplitMethod } from '@/types/models';
import { draftToSplit, SPLIT_METHOD_LABELS, type SplitDraft } from '../logic/splits';

interface SplitEditorProps {
  value: SplitDraft;
  onChange: (value: SplitDraft) => void;
  /** Parsed expense amount, or null when the amount field is empty/invalid. */
  totalMinor: Minor | null;
  error?: string;
}

/** Toggle + editor for splitting an expense equally, by percentage, or by custom amounts. */
export function SplitEditor({ value, onChange, totalMinor, error }: SplitEditorProps) {
  const members = useMembers();
  const currency = useCurrency();
  const result = draftToSplit(value, totalMinor, currency);
  const update = (patch: Partial<SplitDraft>) => onChange({ ...value, ...patch });
  const toggleMember = (userId: string) =>
    update({
      userIds: value.userIds.includes(userId) ? value.userIds.filter((id) => id !== userId) : [...value.userIds, userId],
    });

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 3, p: 1.5 }}>
      <FormControlLabel
        control={<Switch checked={value.enabled} onChange={(event) => update({ enabled: event.target.checked })} />}
        label="Split this expense"
      />
      {!value.enabled ? (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ ml: 6, mt: -0.5 }}>
          Unsplit expenses are treated as personal and don’t affect who owes whom.
        </Typography>
      ) : (
        <Stack spacing={1.5} sx={{ mt: 1 }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={value.method}
            onChange={(_, method: SplitMethod | null) => method && update({ method })}
            aria-label="Split method"
            sx={{ flexWrap: 'wrap' }}
          >
            {(Object.keys(SPLIT_METHOD_LABELS) as SplitMethod[]).map((method) => (
              <ToggleButton key={method} value={method}>
                {SPLIT_METHOD_LABELS[method]}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <Stack spacing={1} role="group" aria-label="Who shares this expense">
            {members.map((member) => {
              const included = value.userIds.includes(member.userId);
              const share = result.split?.shares.find((entry) => entry.userId === member.userId)?.shareMinor;
              return (
                <Stack key={member.userId} direction="row" spacing={1} alignItems="center" sx={{ minHeight: 44 }}>
                  <Checkbox
                    checked={included}
                    onChange={() => toggleMember(member.userId)}
                    inputProps={{ 'aria-label': `Include ${member.name}` }}
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <MemberAvatar userId={member.userId} withName size={24} />
                  </Box>
                  {included && value.method === 'percentage' && (
                    <TextField
                      value={value.percents[member.userId] ?? ''}
                      onChange={(event) => update({ percents: { ...value.percents, [member.userId]: event.target.value } })}
                      sx={{ width: 110 }}
                      slotProps={{
                        htmlInput: { inputMode: 'decimal', 'aria-label': `${member.name} percentage` },
                        input: { endAdornment: <InputAdornment position="end">%</InputAdornment> },
                      }}
                    />
                  )}
                  {included && value.method === 'amount' && (
                    <TextField
                      value={value.amounts[member.userId] ?? ''}
                      onChange={(event) => update({ amounts: { ...value.amounts, [member.userId]: event.target.value } })}
                      sx={{ width: 130 }}
                      slotProps={{ htmlInput: { inputMode: 'decimal', 'aria-label': `${member.name} amount` } }}
                    />
                  )}
                  {included && value.method !== 'amount' && (
                    <Typography variant="body2" sx={{ width: 96, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {share !== undefined ? formatMoney(share, currency) : '—'}
                    </Typography>
                  )}
                </Stack>
              );
            })}
          </Stack>
          <Typography
            variant="body2"
            role="status"
            aria-live="polite"
            sx={(theme) => ({ color: result.error || error ? theme.tokens.errorText : theme.tokens.successText, fontWeight: 600 })}
          >
            {result.error
              ? `${result.error}${value.method !== 'equal' && result.remainingMinor !== 0 && totalMinor ? ` (${result.remainingMinor > 0 ? 'left to allocate' : 'over by'} ${formatMoney(Math.abs(result.remainingMinor), currency)})` : ''}`
              : error ?? 'Shares add up to the full amount.'}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}

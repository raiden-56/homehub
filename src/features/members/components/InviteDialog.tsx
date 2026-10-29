import { useState } from 'react';
import { Alert, Button, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Check, Copy } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCommit, useCurrentUser, useRole } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormSelectField, FormTextField } from '@/components/form/fields';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, assignableRoles } from '@/lib/permissions';
import { optionalText } from '@/lib/validation';
import { INVITE_EXPIRY_OPTIONS, buildInvitation, inviteUrl } from '../invitations';

const schema = z.object({
  label: optionalText(60),
  role: z.enum(['admin', 'member', 'viewer']),
  hours: z.string(),
});
type Values = z.infer<typeof schema>;

export function InviteDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const role = useRole();
  const commit = useCommit();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const roles = assignableRoles(role);
  const { control, handleSubmit, watch, formState, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { label: '', role: roles.includes('member') ? 'member' : roles[0] ?? 'viewer', hours: '72' },
  });
  const selectedRole = watch('role');

  const close = () => {
    setLink(null);
    setCopied(false);
    reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!household || !user) return;
    const invitation = buildInvitation({
      householdId: household.id,
      role: values.role,
      label: values.label,
      createdBy: user.id,
      hours: Number(values.hours),
    });
    const ok = await commit(
      { put: { invitations: [invitation] } },
      {
        action: 'manageMembers',
        activity: { entity: 'member', message: `Created an invite link for a ${ROLE_LABELS[values.role].toLowerCase()}` },
      },
    );
    if (ok) setLink(inviteUrl(invitation.token));
  });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (link) {
    return (
      <FormDialog
        open={open}
        onClose={close}
        title="Invite link ready"
        onSubmit={(event) => {
          event.preventDefault();
          close();
        }}
        submitLabel="Done"
      >
        <Stack spacing={2}>
          <Typography variant="body2">
            Share this link with the person you’re inviting. It can be used once and expires automatically.
          </Typography>
          <TextField
            label="Invite link"
            value={link}
            slotProps={{
              htmlInput: { readOnly: true, onFocus: (event: React.FocusEvent<HTMLInputElement>) => event.target.select() },
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip title={copied ? 'Copied' : 'Copy link'}>
                      <IconButton onClick={copy} aria-label="Copy invite link" edge="end">
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              },
            }}
          />
          {copied && (
            <Typography variant="caption" color="text.secondary" role="status">
              Link copied to clipboard.
            </Typography>
          )}
          <Alert severity="warning">
            Local mode: invite links only work in this browser on this device. The invited person should open it here and
            choose or create their own profile. HomeHub doesn’t send emails.
          </Alert>
        </Stack>
      </FormDialog>
    );
  }

  return (
    <FormDialog
      open={open}
      onClose={close}
      title="Invite someone"
      description="Creates a single-use link with a secure, unguessable token."
      onSubmit={onSubmit}
      submitLabel="Create invite link"
      submitting={formState.isSubmitting}
    >
      <Stack spacing={2}>
        <FormTextField control={control} name="label" label="Who is it for? (optional)" placeholder="e.g. Rahul — new roommate" />
        <FormSelectField
          control={control}
          name="role"
          label="Role"
          options={roles.map((value) => ({ value, label: ROLE_LABELS[value] }))}
          helperText={ROLE_DESCRIPTIONS[selectedRole]}
        />
        <FormSelectField
          control={control}
          name="hours"
          label="Link expires after"
          options={INVITE_EXPIRY_OPTIONS.map((option) => ({ value: String(option.hours), label: option.label }))}
        />
      </Stack>
      <Button sx={{ display: 'none' }} aria-hidden tabIndex={-1} />
    </FormDialog>
  );
}

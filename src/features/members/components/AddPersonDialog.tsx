import { Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useActiveHousehold, useCommit, useRole } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormSelectField, FormTextField } from '@/components/form/fields';
import { buildProfile } from '@/features/household/factory';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, assignableRoles } from '@/lib/permissions';
import { newId, nowIso } from '@/lib/ids';
import { optionalText, requiredText } from '@/lib/validation';

const schema = z.object({
  name: requiredText('Name', 60),
  email: optionalText(120).refine((value) => value === '' || z.email().safeParse(value).success, 'Enter a valid email or leave it blank'),
  role: z.enum(['admin', 'member', 'viewer']),
});
type Values = z.infer<typeof schema>;

/** Adds a person directly as a local profile on this device (no invitation needed). */
export function AddPersonDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const household = useActiveHousehold();
  const role = useRole();
  const commit = useCommit();
  const roles = assignableRoles(role);
  const { control, handleSubmit, watch, formState, reset } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', role: roles.includes('member') ? 'member' : roles[0] ?? 'viewer' },
  });

  const onSubmit = handleSubmit(async (values) => {
    if (!household) return;
    const now = nowIso();
    const profile = buildProfile(values.name, values.email, now);
    const ok = await commit(
      {
        put: {
          ...profile.put,
          memberships: [{ id: newId(), householdId: household.id, userId: profile.user.id, role: values.role, createdAt: now, updatedAt: now }],
        },
      },
      {
        action: 'manageMembers',
        success: `${profile.user.name} added as ${ROLE_LABELS[values.role].toLowerCase()}`,
        activity: { entity: 'member', message: `Added ${profile.user.name} as ${ROLE_LABELS[values.role].toLowerCase()}` },
      },
    );
    if (ok) {
      reset();
      onClose();
    }
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Add a person"
      description="Creates a local profile on this device that they can choose when using HomeHub here."
      onSubmit={onSubmit}
      submitLabel="Add person"
      submitting={formState.isSubmitting}
    >
      <Stack spacing={2}>
        <FormTextField control={control} name="name" label="Name" required autoFocus />
        <FormTextField control={control} name="email" label="Email (optional)" type="email" helperText="Only used as a label." />
        <FormSelectField
          control={control}
          name="role"
          label="Role"
          options={roles.map((value) => ({ value, label: ROLE_LABELS[value] }))}
          helperText={ROLE_DESCRIPTIONS[watch('role')]}
        />
      </Stack>
    </FormDialog>
  );
}

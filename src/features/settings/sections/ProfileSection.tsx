import { useEffect } from 'react';
import { Avatar, Box, Button, ButtonBase, Stack, Typography } from '@mui/material';
import { Check, Trash2, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector, useCommit, useCurrentUser } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { FormTextField } from '@/components/form/fields';
import { initials } from '@/components/ui/MemberAvatar';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { useToast } from '@/components/feedback/ToastProvider';
import { deleteProfile } from '@/features/household/lifecycle';
import { toUserMessage } from '@/data/errors';
import { AVATAR_COLORS } from '@/lib/constants';
import { nowIso } from '@/lib/ids';
import { optionalText, requiredText } from '@/lib/validation';
import { paths } from '@/app/paths';
import { selectMyHouseholds } from '@/store/selectors';

const schema = z.object({
  name: requiredText('Display name', 60),
  email: optionalText(120).refine((value) => value === '' || z.email().safeParse(value).success, 'Enter a valid email or leave it blank'),
  avatarColor: z.string(),
});
type Values = z.infer<typeof schema>;

export function ProfileSection() {
  const user = useCurrentUser();
  const households = useAppSelector(selectMyHouseholds);
  const commit = useCommit();
  const confirm = useConfirm();
  const toast = useToast();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { control, handleSubmit, reset, watch, setValue, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '', avatarColor: user?.avatarColor ?? AVATAR_COLORS[0]! },
  });

  useEffect(() => {
    if (user) reset({ name: user.name, email: user.email ?? '', avatarColor: user.avatarColor });
  }, [user, reset]);

  if (!user) return null;
  const color = watch('avatarColor');
  const ownsHousehold = households.some((entry) => entry.role === 'owner');

  const onSubmit = handleSubmit(async (values) => {
    await commit(
      { put: { users: [{ ...user, name: values.name.trim(), email: values.email.trim() || undefined, avatarColor: values.avatarColor, updatedAt: nowIso() }] } },
      { action: 'view', success: 'Profile updated' },
    );
  });

  const remove = async () => {
    const ok = await confirm({
      title: 'Delete your profile?',
      description: 'Your profile and memberships are removed from this device. Records you created stay in their households. This can’t be undone.',
      confirmLabel: 'Delete profile',
      destructive: true,
    });
    if (!ok) return;
    try {
      await dispatch(deleteProfile());
      navigate(paths.welcome(), { replace: true });
    } catch (error) {
      toast.show({ message: toUserMessage(error), severity: 'error' });
    }
  };

  return (
    <>
      <SectionCard title="Profile" icon={<UserRound size={17} />}>
        <form onSubmit={onSubmit} noValidate>
          <Stack spacing={2.5} sx={{ maxWidth: 520 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar sx={{ width: 56, height: 56, bgcolor: color, color: '#fff', fontWeight: 700, fontSize: 20 }}>
                {initials(watch('name') || user.name)}
              </Avatar>
              <Box>
                <Typography variant="subtitle2" id="avatar-colour-label">
                  Avatar colour
                </Typography>
                <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.75 }} role="radiogroup" aria-labelledby="avatar-colour-label">
                  {AVATAR_COLORS.map((option, index) => (
                    <ButtonBase
                      key={option}
                      role="radio"
                      aria-checked={option === color}
                      aria-label={`Colour ${index + 1}`}
                      onClick={() => setValue('avatarColor', option, { shouldDirty: true })}
                      sx={{
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        bgcolor: option,
                        color: '#fff',
                        outline: option === color ? 2 : 0,
                        outlineColor: 'text.primary',
                        outlineOffset: 2,
                      }}
                    >
                      {option === color && <Check size={14} aria-hidden />}
                    </ButtonBase>
                  ))}
                </Stack>
              </Box>
            </Stack>
            <FormTextField control={control} name="name" label="Display name" required />
            <FormTextField control={control} name="email" label="Email (optional)" type="email" helperText="Shown to household members as a label only. HomeHub never sends email in local mode." />
            <Box>
              <Button type="submit" variant="contained" disabled={!formState.isDirty || formState.isSubmitting}>
                Save profile
              </Button>
            </Box>
          </Stack>
        </form>
      </SectionCard>
      <SectionCard title="Delete profile" icon={<Trash2 size={17} />}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 560 }}>
          {ownsHousehold
            ? 'You own at least one household. Delete those households (Settings → Household) before deleting your profile, so shared data is never left without an owner.'
            : 'Removes your local profile and your memberships from this device.'}
        </Typography>
        <Button color="error" variant="outlined" onClick={remove} disabled={ownsHousehold}>
          Delete my profile
        </Button>
      </SectionCard>
    </>
  );
}

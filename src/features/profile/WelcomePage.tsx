import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ArrowRight, HardDrive, UserPlus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector, useCollection } from '@/app/hooks';
import { createProfile, selectProfile } from '@/data/actions';
import { toUserMessage } from '@/data/errors';
import { buildProfile } from '@/features/household/factory';
import { initials } from '@/components/ui/MemberAvatar';
import { LogoMark } from '@/components/layout/Logo';
import { nowIso } from '@/lib/ids';
import { optionalText, requiredText } from '@/lib/validation';
import { paths } from '@/app/paths';

const schema = z.object({
  name: requiredText('Your name', 60),
  email: optionalText(120).refine((value) => value === '' || z.email().safeParse(value).success, 'Enter a valid email or leave it blank'),
});
type FormValues = z.infer<typeof schema>;

/** Local profile picker. Local mode has no passwords — this only chooses who is using the app. */
export default function WelcomePage() {
  const users = useCollection('users');
  const memberships = useCollection('memberships');
  const households = useAppSelector((state) => state.data.households);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [creating, setCreating] = useState(users.length === 0);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  });

  // Only same-app paths are accepted as a post-login destination (no open redirects).
  const nextParam = searchParams.get('next');
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  const enter = async (userId: string) => {
    setError(null);
    try {
      await dispatch(selectProfile(userId));
      const hasHousehold = memberships.some((membership) => membership.userId === userId);
      navigate(next ?? (hasHousehold ? paths.overview() : paths.onboarding()), { replace: true });
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      const profile = buildProfile(values.name, values.email, nowIso());
      await dispatch(createProfile(profile));
      await dispatch(selectProfile(profile.user.id));
      navigate(next ?? paths.onboarding(), { replace: true });
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  });

  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Box
      component="main"
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        px: 2,
        py: { xs: 4, md: 8 },
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 460 }}>
        <Stack spacing={1.5} alignItems="center" textAlign="center" sx={{ mb: 4 }}>
          <LogoMark size={48} />
          <Typography variant="h1">Welcome to HomeHub</Typography>
          <Typography color="text.secondary">Everything your home needs, organized in one place.</Typography>
        </Stack>

        <Card sx={{ p: { xs: 2.5, sm: 3 } }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {!creating && sortedUsers.length > 0 ? (
            <>
              <Typography variant="h2" sx={{ mb: 0.5 }}>
                Who’s using HomeHub?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose your profile on this device.
              </Typography>
              <Stack spacing={1}>
                {sortedUsers.map((user) => {
                  const count = memberships.filter((membership) => membership.userId === user.id && households[membership.householdId]).length;
                  return (
                    <Card key={user.id} sx={{ borderRadius: 3 }}>
                      <CardActionArea onClick={() => enter(user.id)} sx={{ p: 1.5 }}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ bgcolor: user.avatarColor, color: '#fff', fontWeight: 700 }}>{initials(user.name)}</Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 600 }} noWrap>
                              {user.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {count === 0 ? 'No households yet' : `${count} household${count === 1 ? '' : 's'}`}
                            </Typography>
                          </Box>
                          <ArrowRight size={18} aria-hidden />
                        </Stack>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Stack>
              <Divider sx={{ my: 2.5 }} />
              <Button fullWidth variant="outlined" startIcon={<UserPlus size={18} />} onClick={() => setCreating(true)}>
                Create a new profile
              </Button>
            </>
          ) : (
            <form onSubmit={onSubmit} noValidate>
              <Typography variant="h2" sx={{ mb: 0.5 }}>
                Create your profile
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
                Your name is shown on tasks, purchases and activity.
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Your name"
                  required
                  autoFocus
                  autoComplete="name"
                  {...register('name')}
                  error={!!formState.errors.name}
                  helperText={formState.errors.name?.message}
                />
                <TextField
                  label="Email (optional)"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  error={!!formState.errors.email}
                  helperText={formState.errors.email?.message ?? 'Only used as a label. Nothing is sent anywhere.'}
                />
                <Button type="submit" variant="contained" size="large" disabled={formState.isSubmitting}>
                  Continue
                </Button>
                {sortedUsers.length > 0 && (
                  <Button color="inherit" onClick={() => setCreating(false)}>
                    Back to profiles
                  </Button>
                )}
              </Stack>
            </form>
          )}
        </Card>

        <Stack
          direction="row"
          spacing={1.25}
          sx={(theme) => ({
            mt: 2.5,
            p: 1.75,
            borderRadius: 3,
            backgroundColor: theme.tokens.amberSoft,
            color: theme.tokens.amberText,
          })}
        >
          <HardDrive size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden />
          <Typography variant="body2">
            <strong>Local mode.</strong> HomeHub stores everything in this browser. Profiles are not password protected
            and data does not sync to other devices.
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}

import { useState } from 'react';
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch, useCollection, useCurrentUser, useAppSelector } from '@/app/hooks';
import { commitChanges, switchHousehold } from '@/data/actions';
import { toUserMessage } from '@/data/errors';
import { LogoMark } from '@/components/layout/Logo';
import { ErrorState } from '@/components/ui/ErrorState';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/lib/permissions';
import { formatTimestamp } from '@/lib/dates';
import { nowIso } from '@/lib/ids';
import { paths } from '@/app/paths';
import { buildAcceptance, checkInvitation } from './invitations';

const REASONS = {
  'not-found': {
    title: 'This invitation isn’t valid',
    description:
      'The link may be mistyped, or it was created in a different browser. In local mode, invite links only work on the device where they were created.',
  },
  expired: { title: 'This invitation has expired', description: 'Ask a household owner or admin for a new link.' },
  revoked: { title: 'This invitation was revoked', description: 'Ask a household owner or admin for a new link.' },
  accepted: { title: 'This invitation was already used', description: 'Each invite link can be used once. Ask for a new link if you need one.' },
} as const;

/** Accepts an invitation for the active profile after validating the token. */
export default function InvitePage() {
  const { token = '' } = useParams();
  const user = useCurrentUser();
  const invitations = useCollection('invitations');
  const memberships = useCollection('memberships');
  const households = useAppSelector((state) => state.data.households);
  const users = useAppSelector((state) => state.data.users);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const check = checkInvitation(invitations, memberships, token, user.id);
  const household = check.invitation ? households[check.invitation.householdId] : undefined;

  const accept = async () => {
    if (!check.ok) return;
    setBusy(true);
    setError(null);
    try {
      await dispatch(
        commitChanges(buildAcceptance(check.invitation, user.id, nowIso()), {
          flow: 'acceptInvitation',
          householdId: check.invitation.householdId,
          activity: { entity: 'member', message: `${user.name} joined as ${ROLE_LABELS[check.invitation.role].toLowerCase()}` },
        }),
      );
      await dispatch(switchHousehold(check.invitation.householdId));
      navigate(paths.overview(), { replace: true });
    } catch (caught) {
      setError(toUserMessage(caught));
      setBusy(false);
    }
  };

  return (
    <Box component="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, py: 6 }}>
      <Card sx={{ width: '100%', maxWidth: 480, p: { xs: 3, sm: 4 } }}>
        <Stack alignItems="center" spacing={1.5} textAlign="center">
          <LogoMark size={44} />
          {check.ok && household ? (
            <>
              <Typography variant="h1">Join {household.name}</Typography>
              <Typography color="text.secondary">
                {users[check.invitation.createdBy]?.name ?? 'A household admin'} invited you as{' '}
                <strong>{ROLE_LABELS[check.invitation.role]}</strong>. {ROLE_DESCRIPTIONS[check.invitation.role]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Joining as {user.name} · link expires {formatTimestamp(check.invitation.expiresAt)}
              </Typography>
              {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}>
                <Button color="inherit" onClick={() => navigate(paths.overview())} disabled={busy}>
                  Not now
                </Button>
                <Button variant="contained" onClick={accept} disabled={busy}>
                  {busy ? 'Joining…' : 'Accept invitation'}
                </Button>
              </Stack>
            </>
          ) : !check.ok && check.reason === 'already-member' ? (
            <>
              <Typography variant="h1">You’re already a member</Typography>
              <Typography color="text.secondary">{household?.name ?? 'This household'} is already in your household list.</Typography>
              <Button
                variant="contained"
                onClick={async () => {
                  if (check.invitation) await dispatch(switchHousehold(check.invitation.householdId));
                  navigate(paths.overview());
                }}
              >
                Open household
              </Button>
            </>
          ) : (
            <ErrorState
              kind="forbidden"
              title={REASONS[check.ok ? 'not-found' : (check.reason as keyof typeof REASONS)].title}
              description={REASONS[check.ok ? 'not-found' : (check.reason as keyof typeof REASONS)].description}
              action={
                <Button variant="outlined" onClick={() => navigate(paths.overview())}>
                  Go to HomeHub
                </Button>
              }
            />
          )}
        </Stack>
      </Card>
    </Box>
  );
}

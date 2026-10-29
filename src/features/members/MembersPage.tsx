import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Link2, LogOut, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useActiveHousehold,
  useAppDispatch,
  useCan,
  useCollection,
  useCommit,
  useCurrentUser,
  useHouseholdLoading,
  useMembers,
  useRole,
} from '@/app/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusChip, type StatusTone } from '@/components/ui/StatusChip';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskListSkeleton } from '@/components/ui/Skeletons';
import { useConfirm } from '@/components/feedback/ConfirmProvider';
import { clearActiveHousehold, switchHousehold } from '@/data/actions';
import { selectMyHouseholds } from '@/store/selectors';
import { useAppSelector } from '@/app/hooks';
import { ROLE_DESCRIPTIONS, ROLE_LABELS, assignableRoles, canManageMember } from '@/lib/permissions';
import { formatDate, formatTimestamp } from '@/lib/dates';
import { nowIso } from '@/lib/ids';
import { paths } from '@/app/paths';
import type { Role } from '@/types/models';
import { InviteDialog } from './components/InviteDialog';
import { AddPersonDialog } from './components/AddPersonDialog';
import { invitationState, type InvitationState } from './invitations';

const ROLE_TONE: Record<Role, StatusTone> = { owner: 'primary', admin: 'success', member: 'neutral', viewer: 'warning' };
const INVITE_TONE: Record<InvitationState, StatusTone> = { pending: 'warning', accepted: 'success', expired: 'neutral', revoked: 'danger' };
const INVITE_LABEL: Record<InvitationState, string> = { pending: 'Pending', accepted: 'Accepted', expired: 'Expired', revoked: 'Revoked' };

export default function MembersPage() {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const role = useRole();
  const members = useMembers();
  const invitations = useCollection('invitations').filter((invitation) => invitation.householdId === household?.id);
  const myHouseholds = useAppSelector(selectMyHouseholds);
  const canManage = useCan('manageMembers');
  const loading = useHouseholdLoading();
  const commit = useCommit();
  const confirm = useConfirm();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const membershipsTable = useAppSelector((state) => state.data.memberships);

  if (!household || !user) return null;

  const changeRole = async (membershipId: string, name: string, next: Role) => {
    const membership = membershipsTable[membershipId];
    if (!membership || membership.role === next) return;
    await commit(
      { put: { memberships: [{ ...membership, role: next, updatedAt: nowIso() }] } },
      {
        action: 'manageMembers',
        success: `${name} is now ${ROLE_LABELS[next].toLowerCase()}`,
        activity: { entity: 'member', message: `Changed ${name}’s role to ${ROLE_LABELS[next].toLowerCase()}` },
      },
    );
  };

  const removeMember = async (membershipId: string, name: string) => {
    const ok = await confirm({
      title: `Remove ${name}?`,
      description: `${name} will lose access to ${household.name}. Records they created stay in the household.`,
      confirmLabel: 'Remove member',
      destructive: true,
    });
    if (!ok) return;
    await commit(
      { remove: { memberships: [membershipId] } },
      { action: 'manageMembers', success: `${name} removed`, activity: { entity: 'member', message: `Removed ${name} from the household` } },
    );
  };

  const leave = async () => {
    const mine = members.find((member) => member.userId === user.id);
    if (!mine) return;
    const ok = await confirm({
      title: `Leave ${household.name}?`,
      description: 'You’ll lose access to this household’s records until someone invites you again.',
      confirmLabel: 'Leave household',
      destructive: true,
    });
    if (!ok) return;
    const saved = await commit(
      { remove: { memberships: [mine.membershipId] } },
      { action: 'view', activity: { entity: 'member', message: `${user.name} left the household` } },
    );
    if (!saved) return;
    const next = myHouseholds.find((entry) => entry.household.id !== household.id);
    if (next) await dispatch(switchHousehold(next.household.id));
    else await dispatch(clearActiveHousehold());
    navigate(next ? paths.overview() : paths.onboarding());
  };

  const revoke = async (invitationId: string) => {
    const invitation = invitations.find((entry) => entry.id === invitationId);
    if (!invitation) return;
    const ok = await confirm({
      title: 'Revoke this invitation?',
      description: 'The link will stop working immediately.',
      confirmLabel: 'Revoke',
      destructive: true,
    });
    if (!ok) return;
    await commit(
      { put: { invitations: [{ ...invitation, status: 'revoked', updatedAt: nowIso() }] } },
      { action: 'manageMembers', success: 'Invitation revoked', activity: { entity: 'member', message: 'Revoked an invite link' } },
    );
  };

  const sortedInvites = [...invitations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <PageHeader
        title="Household members"
        description={`People who share ${household.name}. Roles control who can view and change records.`}
        actions={
          canManage ? (
            <>
              <Button variant="outlined" startIcon={<UserPlus size={18} />} onClick={() => setAddOpen(true)}>
                Add person
              </Button>
              <Button variant="contained" startIcon={<Link2 size={18} />} onClick={() => setInviteOpen(true)}>
                Invite
              </Button>
            </>
          ) : undefined
        }
      />

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, alignItems: 'start' }}>
        <Stack spacing={2.5}>
          <SectionCard title="Members" subtitle={`${members.length} ${members.length === 1 ? 'person' : 'people'}`} icon={<Users size={17} />} flush>
            {loading ? (
              <TaskListSkeleton rows={3} />
            ) : (
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {members.map((member) => {
                  const manageable = canManageMember(role, member.role) && member.userId !== user.id;
                  const roles = assignableRoles(role);
                  return (
                    <Box
                      component="li"
                      key={member.membershipId}
                      sx={{ px: 2.5, py: 1.75, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Box sx={{ flex: '1 1 220px', minWidth: 0 }}>
                        <MemberAvatar userId={member.userId} withName size={36} />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 5.5, display: 'block', mt: -0.5 }}>
                          {member.email ?? 'Local profile'} · joined {formatDate(member.joinedAt.slice(0, 10))}
                          {member.userId === user.id ? ' · you' : ''}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 'auto' }}>
                        {manageable && roles.length > 0 ? (
                          <TextField
                            select
                            size="small"
                            value={member.role}
                            onChange={(event) => changeRole(member.membershipId, member.name, event.target.value as Role)}
                            slotProps={{ htmlInput: { 'aria-label': `Role for ${member.name}` } }}
                            sx={{ width: 130 }}
                          >
                            {[...new Set([member.role, ...roles])].map((value) => (
                              <MenuItem key={value} value={value}>
                                {ROLE_LABELS[value]}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <StatusChip tone={ROLE_TONE[member.role]} label={ROLE_LABELS[member.role]} />
                        )}
                        {manageable ? (
                          <Tooltip title={`Remove ${member.name}`}>
                            <IconButton aria-label={`Remove ${member.name}`} onClick={() => removeMember(member.membershipId, member.name)}>
                              <Trash2 size={17} />
                            </IconButton>
                          </Tooltip>
                        ) : member.userId === user.id && member.role !== 'owner' ? (
                          <Tooltip title="Leave household">
                            <IconButton aria-label="Leave household" onClick={leave}>
                              <LogOut size={17} />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Box sx={{ width: 40 }} />
                        )}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </SectionCard>

          {canManage && (
            <SectionCard title="Invitations" subtitle="Single-use links with an expiry time" icon={<Link2 size={17} />} flush>
              {sortedInvites.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Link2 size={20} />}
                  title="No invitations yet"
                  description="Create a link to invite someone to this household."
                  action={
                    <Button size="small" variant="outlined" onClick={() => setInviteOpen(true)}>
                      Create invite link
                    </Button>
                  }
                />
              ) : (
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                  {sortedInvites.map((invitation) => {
                    const state = invitationState(invitation);
                    return (
                      <Box
                        component="li"
                        key={invitation.id}
                        sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}
                      >
                        <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                            {invitation.label ?? `Invite for a ${ROLE_LABELS[invitation.role].toLowerCase()}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {state === 'accepted' && invitation.acceptedAt
                              ? `Accepted ${formatTimestamp(invitation.acceptedAt)}`
                              : state === 'pending'
                                ? `Expires ${formatTimestamp(invitation.expiresAt)}`
                                : `Created ${formatTimestamp(invitation.createdAt)}`}
                          </Typography>
                        </Box>
                        <StatusChip tone="neutral" label={ROLE_LABELS[invitation.role]} />
                        <StatusChip tone={INVITE_TONE[state]} label={INVITE_LABEL[state]} />
                        {state === 'pending' && (
                          <Button size="small" color="error" onClick={() => revoke(invitation.id)}>
                            Revoke
                          </Button>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              )}
            </SectionCard>
          )}
        </Stack>

        <SectionCard title="Roles" icon={<ShieldCheck size={17} />}>
          <Stack spacing={1.75}>
            {(['owner', 'admin', 'member', 'viewer'] as const).map((value) => (
              <Box key={value}>
                <StatusChip tone={ROLE_TONE[value]} label={ROLE_LABELS[value]} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                  {ROLE_DESCRIPTIONS[value]}
                </Typography>
              </Box>
            ))}
            <Card variant="outlined" sx={(theme) => ({ p: 1.5, bgcolor: theme.tokens.surfaceMuted, border: 'none' })}>
              <Typography variant="caption" color="text.secondary">
                Your role: <strong>{role ? ROLE_LABELS[role] : '—'}</strong>. Permissions are enforced by HomeHub’s data layer
                for every change.
              </Typography>
            </Card>
          </Stack>
        </SectionCard>
      </Box>

      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <AddPersonDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

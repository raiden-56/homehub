import { Avatar, AvatarGroup, Stack, Tooltip, Typography } from '@mui/material';
import { useAppSelector } from '@/app/hooks';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface MemberAvatarProps {
  userId: string | undefined;
  size?: number;
  /** Show the name next to the avatar. */
  withName?: boolean;
  /** Text shown when no member is assigned. */
  emptyLabel?: string;
}

export function MemberAvatar({ userId, size = 28, withName, emptyLabel = 'Unassigned' }: MemberAvatarProps) {
  const user = useAppSelector((state) => (userId ? state.data.users[userId] : undefined));
  const name = user?.name ?? (userId ? 'Former member' : emptyLabel);
  const avatar = (
    <Avatar
      alt=""
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        fontWeight: 700,
        bgcolor: user?.avatarColor ?? 'action.disabledBackground',
        color: user ? '#fff' : 'text.secondary',
      }}
    >
      {user ? initials(user.name) : '–'}
    </Avatar>
  );
  if (withName) {
    return (
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        {avatar}
        <Typography variant="body2" noWrap color={user ? 'text.primary' : 'text.secondary'}>
          {name}
        </Typography>
      </Stack>
    );
  }
  return (
    <Tooltip title={name}>
      <span role="img" aria-label={name} style={{ display: 'inline-flex' }}>
        {avatar}
      </span>
    </Tooltip>
  );
}

export function MemberAvatarGroup({ userIds, max = 4, size = 26 }: { userIds: string[]; max?: number; size?: number }) {
  const users = useAppSelector((state) => state.data.users);
  return (
    <AvatarGroup
      max={max}
      sx={{ '& .MuiAvatar-root': { width: size, height: size, fontSize: size * 0.4, borderWidth: 2 } }}
      aria-label={userIds.map((id) => users[id]?.name ?? 'Member').join(', ')}
    >
      {userIds.map((id) => {
        const user = users[id];
        return (
          <Avatar key={id} alt={user?.name ?? 'Member'} sx={{ bgcolor: user?.avatarColor, color: '#fff', fontWeight: 700 }}>
            {user ? initials(user.name) : '?'}
          </Avatar>
        );
      })}
    </AvatarGroup>
  );
}

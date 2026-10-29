import { useState } from 'react';
import {
  Avatar,
  Box,
  ButtonBase,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from '@mui/material';
import { LogOut, Settings, UserRound, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useCurrentUser, useRole } from '@/app/hooks';
import { leaveProfile } from '@/data/actions';
import { ROLE_LABELS } from '@/lib/permissions';
import { initials } from '@/components/ui/MemberAvatar';
import { paths } from '@/app/paths';

interface UserMenuProps {
  /** `full` shows name and role next to the avatar (sidebar footer). */
  variant?: 'avatar' | 'full';
}

export function UserMenu({ variant = 'avatar' }: UserMenuProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const user = useCurrentUser();
  const role = useRole();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  if (!user) return null;

  const go = (to: string) => {
    setAnchor(null);
    navigate(to);
  };

  const avatar = (
    <Avatar sx={{ width: 34, height: 34, bgcolor: user.avatarColor, color: '#fff', fontSize: 13, fontWeight: 700 }}>
      {initials(user.name)}
    </Avatar>
  );

  return (
    <>
      <ButtonBase
        onClick={(event) => setAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-label={`Account menu for ${user.name}`}
        sx={{
          borderRadius: 2.5,
          p: variant === 'full' ? 1 : 0.25,
          width: variant === 'full' ? '100%' : undefined,
          justifyContent: 'flex-start',
          gap: 1.25,
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main' },
        }}
      >
        {avatar}
        {variant === 'full' && (
          <Box sx={{ minWidth: 0, textAlign: 'left' }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {user.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="p">
              {role ? ROLE_LABELS[role] : 'Local profile'}
            </Typography>
          </Box>
        )}
      </ButtonBase>
      <Menu
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: variant === 'full' ? 'top' : 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: variant === 'full' ? 'bottom' : 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2">{user.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {user.email ?? 'Local profile on this device'}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => go(paths.settings('profile'))}>
          <ListItemIcon>
            <UserRound size={16} />
          </ListItemIcon>
          <ListItemText primary="Profile" />
        </MenuItem>
        <MenuItem onClick={() => go(paths.members())}>
          <ListItemIcon>
            <Users size={16} />
          </ListItemIcon>
          <ListItemText primary="Household members" />
        </MenuItem>
        <MenuItem onClick={() => go(paths.settings())}>
          <ListItemIcon>
            <Settings size={16} />
          </ListItemIcon>
          <ListItemText primary="Settings" />
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={async () => {
            setAnchor(null);
            await dispatch(leaveProfile());
            navigate(paths.welcome());
          }}
        >
          <ListItemIcon>
            <LogOut size={16} />
          </ListItemIcon>
          <ListItemText primary="Switch profile" secondary="Local profiles have no password" />
        </MenuItem>
      </Menu>
    </>
  );
}

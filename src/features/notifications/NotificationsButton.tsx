import { useState } from 'react';
import {
  Badge,
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  Drawer,
} from '@mui/material';
import { AlertCircle, AlertTriangle, Bell, BellOff, Info, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { paths } from '@/app/paths';
import { useNotifications, type NotificationView } from './useNotifications';

const SEVERITY_ICON = { danger: AlertCircle, warning: AlertTriangle, info: Info } as const;
const SEVERITY_LABEL = { danger: 'Needs action', warning: 'Coming up', info: 'For your information' } as const;

export function NotificationsButton() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { notifications, unreadCount, markRead, dismiss } = useNotifications();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const open = !!anchor;

  const openItem = (notification: NotificationView) => {
    setAnchor(null);
    if (!notification.read) void markRead([notification.key]);
    navigate(notification.to);
  };

  const content = (
    <Box sx={{ width: isMobile ? '100%' : 380, maxHeight: isMobile ? '80dvh' : 520, display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Box>
          <Typography variant="h3" component="h2">
            Notifications
          </Typography>
          <Typography variant="caption" color="text.secondary">
            In-app reminders · {unreadCount} unread
          </Typography>
        </Box>
        <Button
          size="small"
          disabled={unreadCount === 0}
          onClick={() => markRead(notifications.filter((item) => !item.read).map((item) => item.key))}
        >
          Mark all read
        </Button>
      </Stack>
      {notifications.length === 0 ? (
        <Stack alignItems="center" spacing={1} sx={{ py: 6, px: 3, textAlign: 'center' }} role="status">
          <BellOff size={28} aria-hidden />
          <Typography sx={{ fontWeight: 600 }}>You’re all caught up</Typography>
          <Typography variant="body2" color="text.secondary">
            Reminders for bills, chores, stock and maintenance will appear here.
          </Typography>
        </Stack>
      ) : (
        <List dense sx={{ overflowY: 'auto', py: 0.5 }} aria-label="Notifications">
          {notifications.map((notification) => {
            const Icon = SEVERITY_ICON[notification.severity];
            return (
              <ListItem
                key={notification.key}
                disablePadding
                secondaryAction={
                  <Tooltip title="Dismiss">
                    <IconButton edge="end" size="small" aria-label={`Dismiss: ${notification.title}`} onClick={() => dismiss(notification.key)}>
                      <X size={14} />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemButton onClick={() => openItem(notification)} sx={{ mx: 1, borderRadius: 2, alignItems: 'flex-start', py: 1, pr: 5 }}>
                  <Box
                    sx={(t) => {
                      const palette = {
                        danger: [t.tokens.errorSoft, t.tokens.errorText],
                        warning: [t.tokens.amberSoft, t.tokens.amberText],
                        info: [t.tokens.sage, t.tokens.sageText],
                      }[notification.severity];
                      return {
                        mt: 0.25,
                        mr: 1.5,
                        width: 30,
                        height: 30,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                        backgroundColor: palette[0],
                        color: palette[1],
                      };
                    }}
                  >
                    <Icon size={15} aria-label={SEVERITY_LABEL[notification.severity]} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: notification.read ? 500 : 700 }}>
                      {!notification.read && <Box component="span" sx={visuallyHidden}>Unread: </Box>}
                      {notification.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="p">
                      {notification.description}
                    </Typography>
                  </Box>
                  {!notification.read && (
                    <Box aria-hidden sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', position: 'absolute', right: 12, top: 18 }} />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      )}
      <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
        <Button
          size="small"
          color="inherit"
          onClick={() => {
            setAnchor(null);
            navigate(paths.settings('notifications'));
          }}
        >
          Notification settings
        </Button>
      </Box>
    </Box>
  );

  return (
    <>
      <Tooltip title="Notifications">
        <IconButton
          onClick={(event) => setAnchor(event.currentTarget)}
          aria-label={`Notifications, ${unreadCount} unread`}
          aria-haspopup="dialog"
          aria-expanded={open ? 'true' : undefined}
        >
          <Badge badgeContent={unreadCount} color="secondary" max={99}>
            <Bell size={20} />
          </Badge>
        </IconButton>
      </Tooltip>
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={open}
          onClose={() => setAnchor(null)}
          slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 'env(safe-area-inset-bottom)' } } }}
        >
          {content}
        </Drawer>
      ) : (
        <Popover
          open={open}
          anchorEl={anchor}
          onClose={() => setAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { mt: 1 } } }}
        >
          {content}
        </Popover>
      )}
    </>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

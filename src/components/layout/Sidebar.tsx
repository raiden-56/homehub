import { Box, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, Tooltip, Typography } from '@mui/material';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useActiveHousehold } from '@/app/hooks';
import { Logo } from './Logo';
import { NAV_GROUP_LABELS, isNavItemActive, visibleNavItems, type NavItem } from './navItems';
import { UserMenu } from './UserMenu';
import { LocalModeBadge } from './LocalModeBadge';
import { motionTokens } from '@/components/ui/motion';

export const SIDEBAR_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 76;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const household = useActiveHousehold();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  const items = visibleNavItems(household?.enabledModules);
  const groups = (['daily', 'home', 'household'] as const).map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));

  return (
    <Box
      component={motion.nav}
      aria-label="Main navigation"
      initial={false}
      animate={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      transition={reduce ? { duration: 0 } : motionTokens.base}
      sx={{
        position: 'sticky',
        top: 0,
        height: '100dvh',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent={collapsed ? 'center' : 'space-between'}
        sx={{ px: collapsed ? 1 : 2, pt: 2, pb: 1.5, minHeight: 64 }}
      >
        <Logo collapsed={collapsed} subtitle={household?.name} />
        {!collapsed && (
          <Tooltip title="Collapse sidebar">
            <IconButton size="small" onClick={onToggle} aria-label="Collapse sidebar">
              <PanelLeftClose size={18} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      {collapsed && (
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
          <Tooltip title="Expand sidebar" placement="right">
            <IconButton size="small" onClick={onToggle} aria-label="Expand sidebar">
              <PanelLeftOpen size={18} />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', px: 1.5, pb: 2 }}>
        {groups.map(({ group, items: groupItems }) =>
          groupItems.length === 0 ? null : (
            <Box key={group} sx={{ mt: 1.5 }}>
              {!collapsed && (
                <Typography variant="overline" color="text.secondary" sx={{ px: 1.5, display: 'block', mb: 0.5 }}>
                  {NAV_GROUP_LABELS[group]}
                </Typography>
              )}
              <List disablePadding sx={{ display: 'grid', gap: 0.25 }}>
                {groupItems.map((item) => (
                  <SidebarLink key={item.key} item={item} active={isNavItemActive(item, pathname)} collapsed={collapsed} />
                ))}
              </List>
            </Box>
          ),
        )}
      </Box>

      <Box sx={{ borderTop: 1, borderColor: 'divider', p: 1.5, display: 'grid', gap: 1 }}>
        {!collapsed && <LocalModeBadge />}
        <Box sx={{ display: 'flex', justifyContent: collapsed ? 'center' : 'stretch' }}>
          <UserMenu variant={collapsed ? 'avatar' : 'full'} />
        </Box>
      </Box>
    </Box>
  );
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  const button = (
    <ListItemButton
      component={RouterLink}
      to={item.to}
      selected={active}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      sx={{
        minHeight: 42,
        px: 1.5,
        justifyContent: collapsed ? 'center' : 'flex-start',
        color: active ? undefined : 'text.primary',
        position: 'relative',
      }}
    >
      <ListItemIcon sx={{ minWidth: collapsed ? 0 : 36, color: 'inherit' }}>
        <Icon size={19} strokeWidth={active ? 2.2 : 1.9} aria-hidden />
      </ListItemIcon>
      {!collapsed && (
        <ListItemText
          primary={item.label}
          slotProps={{ primary: { variant: 'body2', fontWeight: active ? 700 : 500, noWrap: true } }}
        />
      )}
    </ListItemButton>
  );
  return collapsed ? (
    <Tooltip title={item.label} placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}

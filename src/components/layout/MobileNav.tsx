import { useState } from 'react';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import { Menu as MenuIcon } from 'lucide-react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useActiveHousehold } from '@/app/hooks';
import { isNavItemActive, visibleNavItems } from './navItems';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import { LocalModeBadge } from './LocalModeBadge';

export const MOBILE_NAV_HEIGHT = 64;

/** Bottom navigation for phones: the most-used destinations plus a labelled "More" sheet. */
export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const household = useActiveHousehold();
  const items = visibleNavItems(household?.enabledModules);
  const primary = items.filter((item) => item.mobilePrimary).slice(0, 4);
  const secondary = items.filter((item) => !primary.includes(item));
  const activePrimary = primary.find((item) => isNavItemActive(item, pathname));
  const value = activePrimary?.key ?? (secondary.some((item) => isNavItemActive(item, pathname)) ? 'more' : false);

  return (
    <>
      <Paper
        component="nav"
        aria-label="Main navigation"
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderTop: 1,
          borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom)',
        }}
      >
        <BottomNavigation value={value} showLabels sx={{ height: MOBILE_NAV_HEIGHT, bgcolor: 'background.paper' }}>
          {primary.map((item) => {
            const Icon = item.icon;
            const active = item.key === value;
            return (
              <BottomNavigationAction
                key={item.key}
                value={item.key}
                label={item.shortLabel ?? item.label}
                icon={<Icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden />}
                component={RouterLink}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                sx={{ minWidth: 0, '& .MuiBottomNavigationAction-label': { fontSize: '0.6875rem', fontWeight: 600, mt: 0.25 } }}
              />
            );
          })}
          <BottomNavigationAction
            value="more"
            label="More"
            icon={<MenuIcon size={21} aria-hidden />}
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            sx={{ minWidth: 0, '& .MuiBottomNavigationAction-label': { fontSize: '0.6875rem', fontWeight: 600, mt: 0.25 } }}
          />
        </BottomNavigation>
      </Paper>

      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        slotProps={{
          paper: {
            sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, pb: 'calc(12px + env(safe-area-inset-bottom))' },
            'aria-label': 'More destinations',
          } as object,
        }}
      >
        <Box aria-hidden sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1 }} />
        <Box sx={{ px: 2, pt: 1.5 }}>
          <Typography variant="overline" color="text.secondary">
            Household
          </Typography>
          <Box sx={{ mt: 0.5, mb: 1 }}>
            <HouseholdSwitcher fullWidth onSwitched={() => setMoreOpen(false)} />
          </Box>
        </Box>
        <List sx={{ px: 1 }}>
          {secondary.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item, pathname);
            return (
              <ListItemButton
                key={item.key}
                component={RouterLink}
                to={item.to}
                selected={active}
                onClick={() => setMoreOpen(false)}
                sx={{ minHeight: 48 }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                  <Icon size={20} aria-hidden />
                </ListItemIcon>
                <ListItemText primary={item.label} slotProps={{ primary: { fontWeight: 600 } }} />
              </ListItemButton>
            );
          })}
        </List>
        <Box sx={{ px: 2 }}>
          <LocalModeBadge />
        </Box>
      </Drawer>
    </>
  );
}

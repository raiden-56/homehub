import { Box, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { HouseholdSwitcher } from './HouseholdSwitcher';
import { QuickAddMenu } from './QuickAddMenu';
import { UserMenu } from './UserMenu';
import { LogoMark } from './Logo';
import { currentNavItem } from './navItems';
import { SearchButton } from '@/features/search/SearchButton';
import { NotificationsButton } from '@/features/notifications/NotificationsButton';

/** Compact top header: page title, household switcher, search, notifications, quick add, account. */
export function TopBar() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { pathname } = useLocation();
  const title = currentNavItem(pathname)?.label ?? 'HomeHub';

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: theme.zIndex.appBar,
        bgcolor: (t) => (t.palette.mode === 'light' ? 'rgba(247, 245, 239, 0.88)' : 'rgba(23, 25, 22, 0.88)'),
        backdropFilter: 'saturate(140%) blur(8px)',
        borderBottom: 1,
        borderColor: 'divider',
        pt: 'env(safe-area-inset-top)',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={{ xs: 1, sm: 1.5 }}
        sx={{ height: { xs: 56, md: 64 }, px: { xs: 2, md: 3 } }}
      >
        {isMobile && <LogoMark size={28} />}
        <Typography
          variant="h3"
          component="p"
          noWrap
          sx={{ flex: { xs: 1, md: '0 1 auto' }, minWidth: 0, fontSize: { xs: '1rem', md: '1.0625rem' } }}
          aria-hidden
        >
          {title}
        </Typography>
        {!isMobile && (
          <Box sx={{ ml: 1 }}>
            <HouseholdSwitcher />
          </Box>
        )}
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
        <SearchButton />
        <NotificationsButton />
        {/* The overview page has its own prominent Add new action. */}
        {pathname !== '/' && <QuickAddMenu />}
        <UserMenu />
      </Stack>
    </Box>
  );
}

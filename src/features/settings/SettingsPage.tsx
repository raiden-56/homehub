import { Box, List, ListItemButton, ListItemIcon, ListItemText, Tab, Tabs, useMediaQuery, useTheme } from '@mui/material';
import { Bell, Database, Home, Palette, UserRound, type LucideIcon } from 'lucide-react';
import { Link as RouterLink, Navigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { paths } from '@/app/paths';
import { ProfileSection } from './sections/ProfileSection';
import { HouseholdSection } from './sections/HouseholdSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { DataSection } from './sections/DataSection';

const SECTIONS = [
  { key: 'profile', label: 'Profile', icon: UserRound, component: ProfileSection },
  { key: 'household', label: 'Household', icon: Home, component: HouseholdSection },
  { key: 'appearance', label: 'Appearance', icon: Palette, component: AppearanceSection },
  { key: 'notifications', label: 'Notifications', icon: Bell, component: NotificationsSection },
  { key: 'data', label: 'Data & backup', icon: Database, component: DataSection },
] as const satisfies readonly { key: string; label: string; icon: LucideIcon; component: () => React.ReactNode }[];

type SectionKey = (typeof SECTIONS)[number]['key'];

export default function SettingsPage() {
  const { section } = useParams();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  if (!section) return <Navigate to={paths.settings('profile')} replace />;
  const current = SECTIONS.find((entry) => entry.key === section);
  if (!current) return <Navigate to={paths.settings('profile')} replace />;
  const Section = current.component;

  return (
    <>
      <PageHeader title="Settings" description="Your profile, household details, appearance, reminders and data." />
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, alignItems: 'start' }}>
        {isDesktop ? (
          <List component="nav" aria-label="Settings sections" sx={{ position: 'sticky', top: 88, display: 'grid', gap: 0.5 }}>
            {SECTIONS.map((entry) => {
              const Icon = entry.icon;
              return (
                <ListItemButton
                  key={entry.key}
                  component={RouterLink}
                  to={paths.settings(entry.key as SectionKey)}
                  selected={entry.key === section}
                  aria-current={entry.key === section ? 'page' : undefined}
                >
                  <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                    <Icon size={18} aria-hidden />
                  </ListItemIcon>
                  <ListItemText primary={entry.label} slotProps={{ primary: { variant: 'body2', fontWeight: 600 } }} />
                </ListItemButton>
              );
            })}
          </List>
        ) : (
          <Tabs value={section} variant="scrollable" scrollButtons="auto" aria-label="Settings sections" sx={{ borderBottom: 1, borderColor: 'divider', minWidth: 0 }}>
            {SECTIONS.map((entry) => (
              <Tab key={entry.key} value={entry.key} label={entry.label} component={RouterLink} to={paths.settings(entry.key as SectionKey)} />
            ))}
          </Tabs>
        )}
        <Box sx={{ minWidth: 0, display: 'grid', gap: 2.5 }}>
          <Section />
        </Box>
      </Box>
    </>
  );
}

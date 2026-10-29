import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useAppSelector, useCommit, useCurrentUser } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { selectCurrentPreferences } from '@/store/selectors';
import { defaultPreferences } from '@/features/household/factory';
import { nowIso } from '@/lib/ids';
import type { MotionPreference, ThemePreference, UserPreference } from '@/types/models';

export function usePreferenceUpdater() {
  const user = useCurrentUser();
  const stored = useAppSelector(selectCurrentPreferences);
  const commit = useCommit();
  const preferences = stored ?? (user ? defaultPreferences(user.id, nowIso()) : undefined);
  const update = (patch: Partial<Omit<UserPreference, 'id'>>, success?: string) =>
    preferences
      ? commit({ put: { preferences: [{ ...preferences, ...patch, updatedAt: nowIso() }] } }, { action: 'view', success })
      : Promise.resolve(false);
  return { preferences, update };
}

export function AppearanceSection() {
  const { preferences, update } = usePreferenceUpdater();
  if (!preferences) return null;

  return (
    <SectionCard title="Appearance" icon={<Palette size={17} />}>
      <Stack spacing={3}>
        <div>
          <Typography variant="subtitle2" id="theme-label" sx={{ mb: 1 }}>
            Theme
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={preferences.theme}
            onChange={(_, value: ThemePreference | null) => value && update({ theme: value })}
            aria-labelledby="theme-label"
            sx={{ flexWrap: 'wrap' }}
          >
            <ToggleButton value="light" sx={{ gap: 1, px: 2 }}>
              <Sun size={16} aria-hidden /> Light
            </ToggleButton>
            <ToggleButton value="dark" sx={{ gap: 1, px: 2 }}>
              <Moon size={16} aria-hidden /> Dark
            </ToggleButton>
            <ToggleButton value="system" sx={{ gap: 1, px: 2 }}>
              <Monitor size={16} aria-hidden /> System
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div>
          <Typography variant="subtitle2" id="motion-label" sx={{ mb: 0.5 }}>
            Motion
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Reduce movement such as page transitions and list animations.
          </Typography>
          <ToggleButtonGroup
            exclusive
            value={preferences.motion}
            onChange={(_, value: MotionPreference | null) => value && update({ motion: value })}
            aria-labelledby="motion-label"
            sx={{ flexWrap: 'wrap' }}
          >
            <ToggleButton value="system" sx={{ px: 2 }}>
              Follow system
            </ToggleButton>
            <ToggleButton value="reduce" sx={{ px: 2 }}>
              Reduce motion
            </ToggleButton>
            <ToggleButton value="full" sx={{ px: 2 }}>
              Full motion
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
      </Stack>
    </SectionCard>
  );
}

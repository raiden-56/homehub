import { useMemo, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { MotionConfig } from 'framer-motion';
import { useAppSelector } from './hooks';
import { selectCurrentPreferences } from '@/store/selectors';
import { createAppTheme } from '@/theme/theme';

/** Applies the active profile's theme and motion preferences. */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const preferences = useAppSelector(selectCurrentPreferences);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const themePreference = preferences?.theme ?? 'system';
  const mode = themePreference === 'system' ? (prefersDark ? 'dark' : 'light') : themePreference;
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const motion = preferences?.motion ?? 'system';
  const reducedMotion = motion === 'reduce' ? 'always' : motion === 'full' ? 'never' : 'user';

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MotionConfig reducedMotion={reducedMotion}>{children}</MotionConfig>
    </ThemeProvider>
  );
}

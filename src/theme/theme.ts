import { alpha, createTheme, type Theme } from '@mui/material/styles';
import { darkTokens, lightTokens, radii, type ModeTokens } from './tokens';

declare module '@mui/material/styles' {
  interface Theme {
    tokens: ModeTokens;
  }
  interface ThemeOptions {
    tokens?: ModeTokens;
  }
}

const FONT_FAMILY = '"Plus Jakarta Sans", "DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';

export function createAppTheme(mode: 'light' | 'dark'): Theme {
  const t = mode === 'light' ? lightTokens : darkTokens;
  const focusRing = `0 0 0 3px ${alpha(t.focus, 0.35)}`;

  return createTheme({
    tokens: t,
    palette: {
      mode,
      primary: { main: t.primary, dark: t.primaryDeep, contrastText: t.primaryContrast },
      secondary: { main: t.terracotta, contrastText: '#FFFFFF' },
      success: { main: t.success, contrastText: '#FFFFFF' },
      warning: { main: t.amber, dark: t.amberText, contrastText: '#2B2410' },
      error: { main: t.error, contrastText: '#FFFFFF' },
      info: { main: t.primary, contrastText: t.primaryContrast },
      background: { default: t.background, paper: t.surface },
      text: { primary: t.text, secondary: t.textSecondary },
      divider: t.border,
      action: {
        hover: alpha(t.primary, mode === 'light' ? 0.06 : 0.1),
        selected: alpha(t.primary, mode === 'light' ? 0.1 : 0.18),
        focus: alpha(t.primary, 0.12),
      },
    },
    shape: { borderRadius: radii.md },
    breakpoints: { values: { xs: 0, sm: 600, md: 900, lg: 1200, xl: 1536 } },
    typography: {
      fontFamily: FONT_FAMILY,
      htmlFontSize: 16,
      fontSize: 14,
      h1: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.25 },
      h2: { fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.015em', lineHeight: 1.3 },
      h3: { fontSize: '1.125rem', fontWeight: 650, letterSpacing: '-0.01em', lineHeight: 1.35 },
      h4: { fontSize: '1rem', fontWeight: 650, lineHeight: 1.4 },
      h5: { fontSize: '0.9375rem', fontWeight: 650, lineHeight: 1.4 },
      h6: { fontSize: '0.875rem', fontWeight: 650, lineHeight: 1.4 },
      subtitle1: { fontSize: '0.9375rem', fontWeight: 600 },
      subtitle2: { fontSize: '0.8125rem', fontWeight: 600 },
      body1: { fontSize: '0.9375rem', lineHeight: 1.55 },
      body2: { fontSize: '0.875rem', lineHeight: 1.5 },
      caption: { fontSize: '0.75rem', lineHeight: 1.45 },
      overline: { fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em' },
      button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: {
            backgroundColor: t.background,
            color: t.text,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          },
          '*:focus-visible': { outline: `2px solid ${t.focus}`, outlineOffset: 2 },
          '.tabular': { fontVariantNumeric: 'tabular-nums' },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              transitionDuration: '0.01ms !important',
            },
          },
        },
      },
      MuiButtonBase: { defaultProps: { disableRipple: false } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 10,
            minHeight: 38,
            paddingInline: 16,
            transition: 'background-color 160ms ease, border-color 160ms ease, transform 120ms ease',
            '&:active': { transform: 'scale(0.98)' },
            '&.Mui-focusVisible': { boxShadow: focusRing },
          },
          sizeSmall: { minHeight: 32, paddingInline: 12, borderRadius: 8 },
          outlined: { borderColor: t.border, '&:hover': { borderColor: alpha(t.primary, 0.5) } },
          containedPrimary: { '&:hover': { backgroundColor: t.primaryDeep } },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            '&.Mui-focusVisible': { boxShadow: focusRing },
          },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: {
            borderRadius: radii.lg,
            borderColor: t.border,
            backgroundColor: t.surface,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: { root: { padding: 20, '&:last-child': { paddingBottom: 20 } } },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600 },
          sizeSmall: { height: 24, fontSize: '0.75rem' },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            backgroundColor: t.surface,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: t.border },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(t.primary, 0.45) },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
          },
        },
      },
      MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
      MuiFormControl: { defaultProps: { size: 'small' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiInputLabel: { styleOverrides: { root: { fontWeight: 500 } } },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: radii.lg, border: `1px solid ${t.border}` },
          paperFullScreen: { borderRadius: 0, border: 'none' },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontSize: '1.125rem', fontWeight: 700, padding: '20px 24px 8px' } },
      },
      MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px 16px' } } },
      MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 20px', gap: 8 } } },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: radii.md,
            border: `1px solid ${t.border}`,
            boxShadow: `0 12px 32px ${alpha('#1E231E', mode === 'light' ? 0.1 : 0.4)}`,
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: radii.md,
            border: `1px solid ${t.border}`,
            boxShadow: `0 12px 32px ${alpha('#1E231E', mode === 'light' ? 0.1 : 0.4)}`,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: { root: { borderRadius: 8, marginInline: 6, minHeight: 38 } },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            '&.Mui-selected': {
              backgroundColor: t.sage,
              color: t.sageText,
              '&:hover': { backgroundColor: t.sage },
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: mode === 'light' ? t.text : '#3A3F37', fontSize: '0.75rem', borderRadius: 8 },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40 },
          indicator: { height: 3, borderRadius: 3 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, minHeight: 40, paddingInline: 12, minWidth: 0 },
        },
      },
      MuiSkeleton: {
        defaultProps: { animation: 'wave' },
        styleOverrides: {
          root: {
            backgroundColor: t.skeleton,
            '&::after': {
              background: `linear-gradient(90deg, transparent, ${t.skeletonHighlight}, transparent)`,
            },
          },
          rounded: { borderRadius: 10 },
        },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 999, height: 8, backgroundColor: t.neutralSoft },
          bar: { borderRadius: 999 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: t.border },
          head: { fontWeight: 600, color: t.textSecondary, fontSize: '0.8125rem' },
        },
      },
      MuiDrawer: { styleOverrides: { paper: { borderColor: t.border, backgroundImage: 'none' } } },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderColor: t.border,
            '&.Mui-selected': { backgroundColor: t.sage, color: t.sageText, '&:hover': { backgroundColor: t.sage } },
          },
        },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: radii.md, alignItems: 'center' } },
      },
      MuiSnackbarContent: { styleOverrides: { root: { borderRadius: radii.md } } },
      MuiCheckbox: { defaultProps: { size: 'small' } },
      MuiSwitch: {
        styleOverrides: {
          switchBase: { '&.Mui-focusVisible + .MuiSwitch-track': { boxShadow: focusRing } },
        },
      },
    },
  });
}

/** HomeHub colour tokens. Forest green + warm neutrals; no blue/purple primaries. */
export const palette = {
  forest: '#355E3B',
  forestDeep: '#24452D',
  sage: '#DCE8D5',
  ivory: '#F7F5EF',
  white: '#FFFFFF',
  charcoal: '#292D29',
  textSecondary: '#777970',
  border: '#E7E5DD',
  amber: '#D5A044',
  terracotta: '#C96F52',
  success: '#4C8157',
  error: '#B94B45',
} as const;

export interface ModeTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textSecondary: string;
  primary: string;
  primaryDeep: string;
  primaryContrast: string;
  sage: string;
  sageText: string;
  amber: string;
  amberSoft: string;
  amberText: string;
  terracotta: string;
  terracottaSoft: string;
  terracottaText: string;
  success: string;
  successSoft: string;
  successText: string;
  error: string;
  errorSoft: string;
  errorText: string;
  neutralSoft: string;
  skeleton: string;
  skeletonHighlight: string;
  focus: string;
}

export const lightTokens: ModeTokens = {
  background: palette.ivory,
  surface: palette.white,
  surfaceMuted: '#F1EFE7',
  border: palette.border,
  text: palette.charcoal,
  // Slightly darkened from #777970 for small body text so it meets WCAG AA (4.5:1) on ivory.
  textSecondary: '#6A6C63',
  primary: palette.forest,
  primaryDeep: palette.forestDeep,
  primaryContrast: '#FFFFFF',
  sage: palette.sage,
  sageText: palette.forestDeep,
  amber: palette.amber,
  amberSoft: '#F6EAD1',
  amberText: '#7A5512',
  terracotta: palette.terracotta,
  terracottaSoft: '#F5E1D9',
  terracottaText: '#8E4128',
  success: palette.success,
  successSoft: '#E1EDE1',
  successText: '#2F5A38',
  error: palette.error,
  errorSoft: '#F5DFDD',
  errorText: '#8F322D',
  neutralSoft: '#EEECE4',
  skeleton: '#ECE9E0',
  skeletonHighlight: '#F6F4EE',
  focus: palette.forest,
};

export const darkTokens: ModeTokens = {
  background: '#171916',
  surface: '#20231F',
  surfaceMuted: '#272B26',
  border: '#343931',
  text: '#ECEAE2',
  textSecondary: '#A9AB9F',
  primary: '#86B08C',
  primaryDeep: '#A6C9AA',
  primaryContrast: '#132017',
  sage: '#2B3B2D',
  sageText: '#CFE2C8',
  amber: '#D9AA55',
  amberSoft: '#3A311F',
  amberText: '#EBCB8B',
  terracotta: '#D7866A',
  terracottaSoft: '#3D2A23',
  terracottaText: '#EFB29C',
  success: '#7FB088',
  successSoft: '#233325',
  successText: '#A9D3B0',
  error: '#E07C75',
  errorSoft: '#3D2524',
  errorText: '#F2ABA6',
  neutralSoft: '#2A2E28',
  skeleton: '#272B26',
  skeletonHighlight: '#30352F',
  focus: '#A6C9AA',
};

/**
 * Categorical chart colours in fixed order (assign by entity, never cycle). Both sets pass the
 * lightness-band, chroma, colour-vision-deficiency and normal-vision separation checks against
 * their chart surface; series beyond six are folded into "Other" (`chartOther`).
 */
export const chartSeries = ['#1B7337', '#D9A23A', '#00729A', '#E07A55', '#9C3F64', '#A9AE3C'];
export const chartSeriesDark = ['#2B7A43', '#BE8826', '#2A93BE', '#CF6645', '#B060A8', '#8E9330'];
export const chartOther = { light: '#A3A59B', dark: '#6E7268' };

export const radii = { sm: 8, md: 12, lg: 16 } as const;

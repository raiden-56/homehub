import { Box, type SxProps, type Theme } from '@mui/material';
import { useCurrency } from '@/app/hooks';
import { formatMoney } from '@/lib/money';
import type { Minor } from '@/types/models';

interface MoneyProps {
  minor: Minor | undefined;
  compact?: boolean;
  /** Shown when `minor` is undefined. */
  fallback?: string;
  sx?: SxProps<Theme>;
}

/** Formats a minor-unit amount in the active household's currency, with tabular numerals. */
export function Money({ minor, compact, fallback = '—', sx }: MoneyProps) {
  const currency = useCurrency();
  return (
    <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', ...sx }}>
      {minor === undefined ? fallback : formatMoney(minor, currency, { compact })}
    </Box>
  );
}

/** Hook form of `<Money>` for string contexts (aria labels, chart tooltips). */
export function useFormatMoney() {
  const currency = useCurrency();
  return (minor: Minor, options?: { compact?: boolean }) => formatMoney(minor, currency, options);
}

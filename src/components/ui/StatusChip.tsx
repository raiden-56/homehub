import type { ReactElement } from 'react';
import { Chip, type ChipProps } from '@mui/material';
import type { ModeTokens } from '@/theme/tokens';

export type StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'terracotta';

const TONES: Record<StatusTone, (t: ModeTokens) => { bg: string; fg: string }> = {
  neutral: (t) => ({ bg: t.neutralSoft, fg: t.textSecondary }),
  primary: (t) => ({ bg: t.sage, fg: t.sageText }),
  success: (t) => ({ bg: t.successSoft, fg: t.successText }),
  warning: (t) => ({ bg: t.amberSoft, fg: t.amberText }),
  danger: (t) => ({ bg: t.errorSoft, fg: t.errorText }),
  terracotta: (t) => ({ bg: t.terracottaSoft, fg: t.terracottaText }),
};

interface StatusChipProps extends Omit<ChipProps, 'color'> {
  tone: StatusTone;
  /** Visible text label — status is never communicated by colour alone. */
  label: string;
  icon?: ReactElement;
}

export function StatusChip({ tone, label, icon, sx, size = 'small', ...rest }: StatusChipProps) {
  return (
    <Chip
      size={size}
      label={label}
      icon={icon}
      sx={[
        (theme) => {
          const { bg, fg } = TONES[tone](theme.tokens);
          return {
            backgroundColor: bg,
            color: fg,
            '& .MuiChip-icon': { color: fg, marginLeft: '6px', width: 14, height: 14 },
          };
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    />
  );
}

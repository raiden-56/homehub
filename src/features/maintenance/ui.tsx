import {
  AirVent,
  Box,
  CookingPot,
  Droplets,
  Refrigerator,
  ShowerHead,
  Sofa,
  Tv,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import { Box as MuiBox } from '@mui/material';
import { useAppSelector } from '@/app/hooks';
import { selectCurrentPreferences } from '@/store/selectors';
import type { StatusTone } from '@/components/ui/StatusChip';
import type { Priority } from '@/types/models';
import {
  DEFAULT_MAINTENANCE_LEAD_DAYS,
  DEFAULT_WARRANTY_LEAD_DAYS,
  type MaintenanceDueStatus,
  type WarrantyStatus,
} from './logic';

export const MAINTENANCE_STATUS_TONES: Record<MaintenanceDueStatus, StatusTone> = {
  overdue: 'danger',
  'due-soon': 'warning',
  scheduled: 'primary',
  completed: 'success',
  cancelled: 'neutral',
};

export const WARRANTY_TONES: Record<WarrantyStatus, StatusTone> = {
  active: 'success',
  expiring: 'warning',
  expired: 'danger',
  none: 'neutral',
};

export const PRIORITY_LABELS: Record<Priority, string> = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };
export const PRIORITY_TONES: Record<Priority, StatusTone> = { high: 'terracotta', medium: 'warning', low: 'neutral' };

const ASSET_ICONS: Record<string, LucideIcon> = {
  'Air conditioner': AirVent,
  Refrigerator,
  'Washing machine': WashingMachine,
  'Water purifier': Droplets,
  'Water heater': ShowerHead,
  'Kitchen appliance': CookingPot,
  Furniture: Sofa,
  Electronics: Tv,
};

export function assetIcon(category: string): LucideIcon {
  return ASSET_ICONS[category] ?? Box;
}

export function AssetIcon({ category, size = 40 }: { category: string; size?: number }) {
  const Icon = assetIcon(category);
  return (
    <MuiBox
      aria-hidden
      sx={(theme) => ({
        width: size,
        height: size,
        borderRadius: 2.5,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        backgroundColor: theme.tokens.sage,
        color: theme.tokens.sageText,
      })}
    >
      <Icon size={size * 0.5} />
    </MuiBox>
  );
}

/** Reminder lead times from the current member's notification preferences. */
export function useLeadDays() {
  const preferences = useAppSelector(selectCurrentPreferences);
  return {
    maintenance: preferences?.notifications.maintenanceLeadDays ?? DEFAULT_MAINTENANCE_LEAD_DAYS,
    warranty: preferences?.notifications.warrantyLeadDays ?? DEFAULT_WARRANTY_LEAD_DAYS,
  };
}

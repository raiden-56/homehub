import { Box } from '@mui/material';
import {
  Building2,
  Car,
  Droplets,
  Flame,
  GraduationCap,
  HeartPulse,
  Home,
  Receipt,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  SprayCan,
  Tv,
  UtensilsCrossed,
  Wifi,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  Electricity: Zap,
  Water: Droplets,
  Gas: Flame,
  Rent: Home,
  Internet: Wifi,
  Mobile: Smartphone,
  'Internet & phone': Wifi,
  'Society maintenance': Building2,
  Subscriptions: Tv,
  Insurance: ShieldCheck,
  Education: GraduationCap,
  Groceries: ShoppingBasket,
  'Household supplies': SprayCan,
  Utilities: Zap,
  'Maintenance & repairs': Wrench,
  Transport: Car,
  'Dining out': UtensilsCrossed,
  Health: HeartPulse,
};

/** Decorative icon well for a bill or expense category; the category name is always shown as text too. */
export function CategoryIcon({ category, size = 36 }: { category: string; size?: number }) {
  const Icon = ICONS[category] ?? Receipt;
  return (
    <Box
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
      <Icon size={Math.round(size * 0.47)} />
    </Box>
  );
}

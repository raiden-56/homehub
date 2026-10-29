import {
  CalendarDays,
  CheckSquare,
  FileText,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/types/models';

export interface NavItem {
  key: string;
  label: string;
  /** Shorter label for the mobile bottom bar. */
  shortLabel?: string;
  to: string;
  icon: LucideIcon;
  /** Optional module this destination belongs to (hidden when the module is turned off). */
  module?: ModuleKey;
  group: 'daily' | 'home' | 'household';
  /** Shown directly in the mobile bottom bar. */
  mobilePrimary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'overview', label: 'Overview', to: '/', icon: LayoutDashboard, group: 'daily', mobilePrimary: true },
  { key: 'inventory', label: 'Inventory', to: '/inventory', icon: Package, module: 'inventory', group: 'daily', mobilePrimary: true },
  { key: 'shopping', label: 'Shopping', to: '/shopping', icon: ShoppingCart, module: 'shopping', group: 'daily', mobilePrimary: true },
  { key: 'tasks', label: 'Chores & Tasks', shortLabel: 'Tasks', to: '/tasks', icon: CheckSquare, module: 'tasks', group: 'daily', mobilePrimary: true },
  { key: 'finance', label: 'Bills & Expenses', shortLabel: 'Money', to: '/finance', icon: Wallet, module: 'finance', group: 'home' },
  { key: 'maintenance', label: 'Maintenance', to: '/maintenance', icon: Wrench, module: 'maintenance', group: 'home' },
  { key: 'calendar', label: 'Calendar', to: '/calendar', icon: CalendarDays, module: 'calendar', group: 'home' },
  { key: 'documents', label: 'Documents', to: '/documents', icon: FileText, module: 'documents', group: 'home' },
  { key: 'members', label: 'Household Members', shortLabel: 'Members', to: '/members', icon: Users, group: 'household' },
  { key: 'settings', label: 'Settings', to: '/settings', icon: Settings, group: 'household' },
];

export const NAV_GROUP_LABELS: Record<NavItem['group'], string> = {
  daily: 'Everyday',
  home: 'Money & home',
  household: 'Household',
};

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/';
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function visibleNavItems(enabledModules: ModuleKey[] | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.module || !enabledModules || enabledModules.includes(item.module));
}

export function currentNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => isNavItemActive(item, pathname));
}

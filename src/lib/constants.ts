import type { HouseholdType, ModuleKey } from '@/types/models';

export const HOUSEHOLD_TYPE_LABELS: Record<HouseholdType, string> = {
  individual: 'Just me',
  couple: 'Couple',
  family: 'Family',
  roommates: 'Roommates',
};

export const MODULE_INFO: Record<ModuleKey, { label: string; description: string }> = {
  inventory: { label: 'Inventory & pantry', description: 'Track supplies, stock levels and expiry dates.' },
  shopping: { label: 'Shopping lists', description: 'Shared lists that update inventory and expenses.' },
  tasks: { label: 'Chores & tasks', description: 'Assign chores, recurring tasks and a fair workload view.' },
  finance: { label: 'Bills & expenses', description: 'Recurring bills, shared expenses, budgets and reports.' },
  maintenance: { label: 'Maintenance', description: 'Appliances, warranties and service schedules.' },
  calendar: { label: 'Calendar', description: 'Household events alongside chores, bills and services.' },
  documents: { label: 'Documents', description: 'Receipts, warranties and manuals stored privately.' },
};

export const DEFAULT_INVENTORY_CATEGORIES = [
  'Grains & staples',
  'Fruits & vegetables',
  'Dairy & eggs',
  'Meat & seafood',
  'Snacks',
  'Beverages',
  'Cleaning supplies',
  'Toiletries',
  'Paper products',
  'Kitchen supplies',
  'Miscellaneous',
];

export const DEFAULT_STORAGE_LOCATIONS = [
  'Pantry',
  'Refrigerator',
  'Freezer',
  'Kitchen cabinet',
  'Bathroom',
  'Laundry room',
  'Storage room',
];

export const UNITS = ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'bottle', 'box', 'dozen', 'roll', 'can', 'bag'];

export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Household supplies',
  'Utilities',
  'Rent',
  'Internet & phone',
  'Maintenance & repairs',
  'Subscriptions',
  'Insurance',
  'Education',
  'Transport',
  'Dining out',
  'Health',
  'Other',
];

export const BILL_CATEGORIES = [
  'Electricity',
  'Water',
  'Gas',
  'Rent',
  'Internet',
  'Mobile',
  'Society maintenance',
  'Subscriptions',
  'Insurance',
  'Education',
  'Other',
];

/** Expense category used when a paid bill is recorded as an expense. */
export const BILL_TO_EXPENSE_CATEGORY: Record<string, string> = {
  Electricity: 'Utilities',
  Water: 'Utilities',
  Gas: 'Utilities',
  Rent: 'Rent',
  Internet: 'Internet & phone',
  Mobile: 'Internet & phone',
  'Society maintenance': 'Rent',
  Subscriptions: 'Subscriptions',
  Insurance: 'Insurance',
  Education: 'Education',
};

export const PAYMENT_METHODS = ['UPI', 'Cash', 'Debit card', 'Credit card', 'Net banking', 'Other'];

export const TASK_CATEGORIES = ['Cleaning', 'Kitchen', 'Laundry', 'Errands', 'Outdoor', 'Pets', 'Admin', 'Other'];

export const ASSET_CATEGORIES = [
  'Air conditioner',
  'Refrigerator',
  'Washing machine',
  'Water purifier',
  'Water heater',
  'Kitchen appliance',
  'Furniture',
  'Electronics',
  'Other',
];

export const DOCUMENT_CATEGORIES = [
  'Bill',
  'Receipt',
  'Warranty',
  'Manual',
  'Service invoice',
  'Insurance',
  'Agreement',
  'Other',
];

/** Warm, non-blue avatar colours; all pass AA contrast with white initials. */
export const AVATAR_COLORS = ['#355E3B', '#A4563B', '#7A5C3E', '#3F6E6B', '#8A6A1F', '#5B6B3A', '#8C4A3E', '#4C6E52'];

export function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

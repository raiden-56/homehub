import type {
  ActivityLog,
  Asset,
  Bill,
  BillOccurrence,
  Budget,
  CalendarEvent,
  DashboardLayout,
  Expense,
  Household,
  HouseholdDocument,
  HouseholdInvitation,
  HouseholdMembership,
  InventoryCategory,
  InventoryItem,
  InventoryLocation,
  InventoryMovement,
  MaintenanceRecord,
  MaintenanceTask,
  NotificationState,
  Settlement,
  ShoppingItem,
  ShoppingList,
  Task,
  User,
  UserPreference,
} from '@/types/models';

/** Records that are not owned by a single household. */
export interface GlobalCollections {
  users: User;
  households: Household;
  memberships: HouseholdMembership;
  invitations: HouseholdInvitation;
  preferences: UserPreference;
}

/** Records owned by one household; loaded only for the active household. */
export interface HouseholdCollections {
  inventoryCategories: InventoryCategory;
  inventoryLocations: InventoryLocation;
  inventoryItems: InventoryItem;
  inventoryMovements: InventoryMovement;
  shoppingLists: ShoppingList;
  shoppingItems: ShoppingItem;
  tasks: Task;
  bills: Bill;
  billOccurrences: BillOccurrence;
  expenses: Expense;
  settlements: Settlement;
  budgets: Budget;
  assets: Asset;
  maintenanceTasks: MaintenanceTask;
  maintenanceRecords: MaintenanceRecord;
  events: CalendarEvent;
  documents: HouseholdDocument;
  activity: ActivityLog;
  dashboardLayouts: DashboardLayout;
  notificationStates: NotificationState;
}

export type Collections = GlobalCollections & HouseholdCollections;
export type CollectionName = keyof Collections;
export type GlobalCollectionName = keyof GlobalCollections;
export type HouseholdCollectionName = keyof HouseholdCollections;

export const GLOBAL_COLLECTIONS: GlobalCollectionName[] = [
  'users',
  'households',
  'memberships',
  'invitations',
  'preferences',
];

export const HOUSEHOLD_COLLECTIONS: HouseholdCollectionName[] = [
  'inventoryCategories',
  'inventoryLocations',
  'inventoryItems',
  'inventoryMovements',
  'shoppingLists',
  'shoppingItems',
  'tasks',
  'bills',
  'billOccurrences',
  'expenses',
  'settlements',
  'budgets',
  'assets',
  'maintenanceTasks',
  'maintenanceRecords',
  'events',
  'documents',
  'activity',
  'dashboardLayouts',
  'notificationStates',
];

export function isHouseholdCollection(name: CollectionName): name is HouseholdCollectionName {
  return (HOUSEHOLD_COLLECTIONS as string[]).includes(name);
}

/** A batch of writes applied atomically to IndexedDB and then to the Redux store. */
export interface ChangeSet {
  put?: { [K in CollectionName]?: Collections[K][] };
  remove?: { [K in CollectionName]?: string[] };
}

/**
 * Domain model for HomeHub.
 *
 * Conventions:
 * - `ISODate` is a date-only value (`YYYY-MM-DD`) interpreted in the household time zone.
 * - `ISODateTime` is a full UTC timestamp (`Date#toISOString()`).
 * - Money is always stored as integer minor units (e.g. paise) in `*Minor` fields.
 * - Every household-owned record carries `householdId`; the data layer refuses writes
 *   whose `householdId` does not match the active household.
 */

export type ID = string;
export type ISODate = string;
export type ISODateTime = string;
export type Minor = number;

export interface BaseRecord {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface HouseholdRecord extends BaseRecord {
  householdId: ID;
}

/* ------------------------------------------------------------------ */
/* People & households                                                 */
/* ------------------------------------------------------------------ */

export interface User extends BaseRecord {
  name: string;
  email?: string;
  avatarColor: string;
}

export type HouseholdType = 'individual' | 'couple' | 'family' | 'roommates';

export const MODULE_KEYS = [
  'inventory',
  'shopping',
  'tasks',
  'finance',
  'maintenance',
  'calendar',
  'documents',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface Household extends BaseRecord {
  name: string;
  type: HouseholdType;
  description?: string;
  currency: string;
  timeZone: string;
  enabledModules: ModuleKey[];
  customExpenseCategories: string[];
  ownerId: ID;
  isDemo?: boolean;
}

export type Role = 'owner' | 'admin' | 'member' | 'viewer';

export interface HouseholdMembership extends BaseRecord {
  householdId: ID;
  userId: ID;
  role: Role;
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked';

export interface HouseholdInvitation extends BaseRecord {
  householdId: ID;
  token: string;
  role: Exclude<Role, 'owner'>;
  label?: string;
  createdBy: ID;
  expiresAt: ISODateTime;
  status: InvitationStatus;
  acceptedBy?: ID;
  acceptedAt?: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Repeat every N units of `frequency`. */
  interval: number;
  /** Weekly only: weekdays 0 (Sunday) – 6 (Saturday). */
  byWeekday?: number[];
  /** Last date (inclusive) on which an occurrence may fall. */
  until?: ISODate;
}

/* ------------------------------------------------------------------ */
/* Inventory                                                           */
/* ------------------------------------------------------------------ */

export interface InventoryCategory extends HouseholdRecord {
  name: string;
}

export interface InventoryLocation extends HouseholdRecord {
  name: string;
}

export interface InventoryItem extends HouseholdRecord {
  name: string;
  categoryId: ID;
  locationId: ID;
  quantity: number;
  unit: string;
  minQuantity: number;
  purchasePriceMinor?: Minor;
  purchaseDate?: ISODate;
  expiryDate?: ISODate;
  barcode?: string;
  notes?: string;
  archived: boolean;
}

export type InventoryMovementType = 'initial' | 'restock' | 'consume' | 'adjust' | 'purchase';

export interface InventoryMovement extends HouseholdRecord {
  itemId: ID;
  type: InventoryMovementType;
  /** Signed change in quantity. */
  delta: number;
  quantityAfter: number;
  note?: string;
  actorId: ID;
  occurredAt: ISODateTime;
  sourceShoppingItemId?: ID;
}

/* ------------------------------------------------------------------ */
/* Shopping                                                            */
/* ------------------------------------------------------------------ */

export interface ShoppingList extends HouseholdRecord {
  name: string;
  archived: boolean;
  createdBy: ID;
  lastActivityAt: ISODateTime;
}

export type ShoppingPriority = 'low' | 'normal' | 'high';

export interface ShoppingItem extends HouseholdRecord {
  listId: ID;
  name: string;
  quantity: number;
  unit: string;
  categoryId?: ID;
  estimatedPriceMinor?: Minor;
  actualPriceMinor?: Minor;
  priority: ShoppingPriority;
  notes?: string;
  purchased: boolean;
  purchasedAt?: ISODateTime;
  purchasedBy?: ID;
  addedBy: ID;
  sortOrder: number;
  /** Inventory item this entry restocks, when known. */
  inventoryItemId?: ID;
  /** Set once the purchase has been received into inventory / expenses. */
  receivedAt?: ISODateTime;
  receivedMovementId?: ID;
  expenseId?: ID;
  /** Set by "Clear completed": hidden from the list but kept for purchase history. */
  clearedAt?: ISODateTime;
}

/* ------------------------------------------------------------------ */
/* Tasks & chores                                                      */
/* ------------------------------------------------------------------ */

export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export type Priority = 'low' | 'medium' | 'high';

export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
}

export interface TaskComment {
  id: ID;
  authorId: ID;
  text: string;
  createdAt: ISODateTime;
}

export interface Task extends HouseholdRecord {
  title: string;
  description?: string;
  category: string;
  assigneeId?: ID;
  dueDate?: ISODate;
  /** `HH:mm`, household-local. */
  dueTime?: string;
  priority: Priority;
  status: TaskStatus;
  recurrence?: RecurrenceRule;
  /** Shared by every occurrence of a recurring task. */
  seriesId?: ID;
  checklist: ChecklistItem[];
  comments: TaskComment[];
  notes?: string;
  reminderMinutesBefore?: number;
  completedAt?: ISODateTime;
  completedBy?: ID;
  /** Ordering within a Kanban column. */
  boardOrder: number;
  createdBy: ID;
}

/* ------------------------------------------------------------------ */
/* Bills, expenses & budgets                                           */
/* ------------------------------------------------------------------ */

/** A bill definition: one-off or the template for a recurring series. */
export interface Bill extends HouseholdRecord {
  name: string;
  category: string;
  amountMinor: Minor;
  /** First (anchor) due date of the series. */
  startDate: ISODate;
  recurrence?: RecurrenceRule;
  payerId?: ID;
  notes?: string;
  documentId?: ID;
  /** Cancelled series stop generating new occurrences. */
  active: boolean;
}

export type BillOccurrenceState = 'open' | 'paid' | 'cancelled';

/** A concrete amount due on a specific date. ID is deterministic: `${billId}_${originalDate}`. */
export interface BillOccurrence extends HouseholdRecord {
  billId: ID;
  /** Date generated from the recurrence rule — used for de-duplication. */
  originalDate: ISODate;
  dueDate: ISODate;
  amountMinor: Minor;
  state: BillOccurrenceState;
  paidAt?: ISODate;
  paidAmountMinor?: Minor;
  paidBy?: ID;
  expenseId?: ID;
  notes?: string;
}

export type SplitMethod = 'equal' | 'percentage' | 'amount';

export interface SplitShare {
  userId: ID;
  shareMinor: Minor;
  /** Basis points (100 = 1%) when the method is `percentage`. */
  percentBp?: number;
}

export interface ExpenseSplit {
  method: SplitMethod;
  shares: SplitShare[];
}

export type ExpenseSource = 'manual' | 'shopping' | 'bill' | 'maintenance';

export interface Expense extends HouseholdRecord {
  description: string;
  amountMinor: Minor;
  date: ISODate;
  category: string;
  payerId: ID;
  paymentMethod?: string;
  notes?: string;
  receiptDocumentId?: ID;
  source: ExpenseSource;
  sourceId?: ID;
  split?: ExpenseSplit;
}

export interface Settlement extends HouseholdRecord {
  fromUserId: ID;
  toUserId: ID;
  amountMinor: Minor;
  date: ISODate;
  note?: string;
}

export interface CategoryBudget {
  category: string;
  limitMinor: Minor;
}

/** One budget per household (`id === householdId`), applied per calendar month. */
export interface Budget extends HouseholdRecord {
  overallMinor?: Minor;
  /** Percentage (0–100) of a budget at which a warning is shown. */
  warningPercent: number;
  categories: CategoryBudget[];
}

/* ------------------------------------------------------------------ */
/* Maintenance                                                         */
/* ------------------------------------------------------------------ */

export interface Asset extends HouseholdRecord {
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: ISODate;
  purchasePriceMinor?: Minor;
  warrantyExpiry?: ISODate;
  location?: string;
  notes?: string;
  archived: boolean;
}

export type MaintenanceStatus = 'scheduled' | 'completed' | 'cancelled';

export interface MaintenanceTask extends HouseholdRecord {
  name: string;
  assetId?: ID;
  description?: string;
  dueDate: ISODate;
  recurrence?: RecurrenceRule;
  seriesId?: ID;
  priority: Priority;
  assigneeId?: ID;
  provider?: string;
  estimatedCostMinor?: Minor;
  status: MaintenanceStatus;
  notes?: string;
  documentIds: ID[];
  recordId?: ID;
}

export interface MaintenanceRecord extends HouseholdRecord {
  assetId?: ID;
  maintenanceTaskId?: ID;
  completedDate: ISODate;
  workPerformed: string;
  provider?: string;
  actualCostMinor?: Minor;
  notes?: string;
  documentIds: ID[];
  expenseId?: ID;
  recordedBy: ID;
}

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

export type EventCategory = 'household' | 'appointment' | 'social' | 'reminder' | 'other';

export interface CalendarEvent extends HouseholdRecord {
  title: string;
  description?: string;
  category: EventCategory;
  date: ISODate;
  endDate?: ISODate;
  allDay: boolean;
  startTime?: string;
  endTime?: string;
  location?: string;
  memberIds: ID[];
  recurrence?: RecurrenceRule;
  reminderMinutesBefore?: number;
  createdBy: ID;
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

export type DocumentLinkType = 'asset' | 'bill' | 'expense' | 'maintenance';

export interface DocumentLink {
  type: DocumentLinkType;
  id: ID;
}

export interface HouseholdDocument extends HouseholdRecord {
  title: string;
  category: string;
  fileName: string;
  mimeType: string;
  size: number;
  notes?: string;
  expiryDate?: ISODate;
  links: DocumentLink[];
  archived: boolean;
  uploadedBy: ID;
}

/** Binary payload of a document, kept in its own store so lists stay light. */
export interface DocumentBlob {
  id: ID;
  householdId: ID;
  blob: Blob;
}

/* ------------------------------------------------------------------ */
/* Activity, notifications & preferences                               */
/* ------------------------------------------------------------------ */

export type ActivityEntity =
  | 'inventory'
  | 'shopping'
  | 'task'
  | 'bill'
  | 'expense'
  | 'settlement'
  | 'budget'
  | 'asset'
  | 'maintenance'
  | 'event'
  | 'document'
  | 'member'
  | 'household';

export interface ActivityLog extends HouseholdRecord {
  actorId: ID;
  entity: ActivityEntity;
  entityId?: ID;
  message: string;
}

/** Read/dismissed state for a derived in-app notification. `id = ${userId}:${key}`. */
export interface NotificationState extends HouseholdRecord {
  userId: ID;
  key: string;
  readAt?: ISODateTime;
  dismissedAt?: ISODateTime;
}

export type DashboardWidgetKey =
  | 'tasks'
  | 'shopping'
  | 'bills'
  | 'inventory'
  | 'maintenance'
  | 'spending'
  | 'activity'
  | 'insights';

export interface DashboardWidgetConfig {
  key: DashboardWidgetKey;
  hidden: boolean;
  size: 'regular' | 'wide';
}

/** Per user + household. `id = ${userId}:${householdId}`. */
export interface DashboardLayout extends HouseholdRecord {
  userId: ID;
  widgets: DashboardWidgetConfig[];
}

export type ThemePreference = 'light' | 'dark' | 'system';
export type MotionPreference = 'system' | 'reduce' | 'full';

export type NotificationCategory =
  | 'bills'
  | 'tasks'
  | 'inventory'
  | 'expiry'
  | 'maintenance'
  | 'warranty'
  | 'invitations';

export interface NotificationPreferences {
  enabled: Record<NotificationCategory, boolean>;
  billLeadDays: number;
  expiryLeadDays: number;
  maintenanceLeadDays: number;
  warrantyLeadDays: number;
}

/** Per user. `id === userId`. */
export interface UserPreference extends BaseRecord {
  theme: ThemePreference;
  motion: MotionPreference;
  notifications: NotificationPreferences;
}

/** Idempotency marker; a second write with the same key is rejected. */
export interface OperationMarker {
  id: string;
  householdId: ID;
  at: ISODateTime;
}

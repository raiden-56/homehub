import type { ChangeSet } from '@/data/collections';
import type {
  Household,
  HouseholdMembership,
  HouseholdType,
  InventoryCategory,
  InventoryLocation,
  ModuleKey,
  User,
  UserPreference,
} from '@/types/models';
import { MODULE_KEYS } from '@/types/models';
import { newId } from '@/lib/ids';
import { DEFAULT_INVENTORY_CATEGORIES, DEFAULT_STORAGE_LOCATIONS, pickAvatarColor } from '@/lib/constants';

export function defaultPreferences(userId: string, now: string): UserPreference {
  return {
    id: userId,
    theme: 'system',
    motion: 'system',
    notifications: {
      enabled: {
        bills: true,
        tasks: true,
        inventory: true,
        expiry: true,
        maintenance: true,
        warranty: true,
        invitations: true,
      },
      billLeadDays: 7,
      expiryLeadDays: 5,
      maintenanceLeadDays: 7,
      warrantyLeadDays: 30,
    },
    createdAt: now,
    updatedAt: now,
  };
}

export function buildProfile(name: string, email: string | undefined, now: string): ChangeSet & { user: User } {
  const id = newId();
  const user: User = {
    id,
    name: name.trim(),
    email: email?.trim() || undefined,
    avatarColor: pickAvatarColor(id),
    createdAt: now,
    updatedAt: now,
  };
  return { user, put: { users: [user], preferences: [defaultPreferences(id, now)] } };
}

export interface NewHouseholdInput {
  name: string;
  type: HouseholdType;
  description?: string;
  currency: string;
  timeZone: string;
  enabledModules?: ModuleKey[];
}

export function buildTaxonomy(householdId: string, now: string) {
  const categories: InventoryCategory[] = DEFAULT_INVENTORY_CATEGORIES.map((name) => ({
    id: newId(),
    householdId,
    name,
    createdAt: now,
    updatedAt: now,
  }));
  const locations: InventoryLocation[] = DEFAULT_STORAGE_LOCATIONS.map((name) => ({
    id: newId(),
    householdId,
    name,
    createdAt: now,
    updatedAt: now,
  }));
  return { categories, locations };
}

/** Change set for a new household owned by `ownerId`, with default categories and locations. */
export function buildNewHousehold(
  input: NewHouseholdInput,
  ownerId: string,
  now: string,
  options: { id?: string; isDemo?: boolean } = {},
): { household: Household; changes: ChangeSet; taxonomy: ReturnType<typeof buildTaxonomy> } {
  const id = options.id ?? newId();
  const household: Household = {
    id,
    name: input.name.trim(),
    type: input.type,
    description: input.description?.trim() || undefined,
    currency: input.currency,
    timeZone: input.timeZone,
    enabledModules: input.enabledModules ?? [...MODULE_KEYS],
    customExpenseCategories: [],
    ownerId,
    isDemo: options.isDemo,
    createdAt: now,
    updatedAt: now,
  };
  const membership: HouseholdMembership = {
    id: newId(),
    householdId: id,
    userId: ownerId,
    role: 'owner',
    createdAt: now,
    updatedAt: now,
  };
  const taxonomy = buildTaxonomy(id, now);
  return {
    household,
    taxonomy,
    changes: {
      put: {
        households: [household],
        memberships: [membership],
        inventoryCategories: taxonomy.categories,
        inventoryLocations: taxonomy.locations,
      },
    },
  };
}

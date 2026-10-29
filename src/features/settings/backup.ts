import { z } from 'zod';
import type { AppDispatch, RootState } from '@/app/store';
import { HOUSEHOLD_COLLECTIONS, type ChangeSet, type HouseholdCollectionName } from '@/data/collections';
import {
  deleteHouseholdRecords,
  getDocumentBlobsForHousehold,
  loadHousehold,
  writeChanges,
  type HouseholdSnapshot,
} from '@/data/db';
import { BusinessRuleError, PermissionError } from '@/data/errors';
import { reloadGlobal, switchHousehold } from '@/data/actions';
import { broadcastChange } from '@/data/sync';
import { can } from '@/lib/permissions';
import { newId } from '@/lib/ids';
import { defaultPreferences } from '@/features/household/factory';
import type { DocumentBlob, Household, HouseholdMembership, User } from '@/types/models';

export const BACKUP_FORMAT = 'homehub-backup';
export const BACKUP_VERSION = 1;
/** Restores are refused above this size to keep the browser responsive. */
export const MAX_BACKUP_BYTES = 200 * 1024 * 1024;

interface BackupFile {
  dataUrl: string;
  id: string;
}

export interface HouseholdBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  household: Household;
  users: Pick<User, 'id' | 'name' | 'email' | 'avatarColor' | 'createdAt' | 'updatedAt'>[];
  memberships: HouseholdMembership[];
  collections: HouseholdSnapshot;
  files: BackupFile[];
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) throw new BusinessRuleError('A document in the backup is corrupted.');
  const [, mime = 'application/octet-stream', base64, payload = ''] = match;
  if (!base64) return new Blob([decodeURIComponent(payload)], { type: mime });
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: mime });
}

/**
 * Full backup of one household: every household record plus document files. Invitation tokens
 * are deliberately excluded because they are secrets.
 */
export async function buildBackup(state: RootState, householdId: string): Promise<Blob> {
  const household = state.data.households[householdId];
  if (!household) throw new BusinessRuleError('That household no longer exists.');
  const collections = await loadHousehold(householdId);
  const memberships = Object.values(state.data.memberships).filter((membership) => membership.householdId === householdId);
  const users = memberships.flatMap((membership) => {
    const user = state.data.users[membership.userId];
    return user ? [{ id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, createdAt: user.createdAt, updatedAt: user.updatedAt }] : [];
  });
  const blobs = await getDocumentBlobsForHousehold(householdId);
  const files = await Promise.all(blobs.map(async (entry) => ({ id: entry.id, dataUrl: await blobToDataUrl(entry.blob) })));
  const backup: HouseholdBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    household,
    users,
    memberships,
    collections,
    files,
  };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

/** Household records without document files — a readable export of everything else. */
export async function buildJsonExport(state: RootState, householdId: string): Promise<Blob> {
  const household = state.data.households[householdId];
  const collections = await loadHousehold(householdId);
  return new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), household, ...collections }, null, 2)], {
    type: 'application/json',
  });
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

const record = z.object({ id: z.string().min(1), householdId: z.string().min(1) }).passthrough();

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.string(),
  household: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1).max(120),
      type: z.enum(['individual', 'couple', 'family', 'roommates']),
      currency: z.string().min(3).max(3),
      timeZone: z.string().min(1),
      enabledModules: z.array(z.string()),
      customExpenseCategories: z.array(z.string()),
      ownerId: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })
    .passthrough(),
  users: z.array(
    z.object({ id: z.string().min(1), name: z.string().min(1).max(120), avatarColor: z.string(), createdAt: z.string(), updatedAt: z.string() }).passthrough(),
  ),
  memberships: z.array(
    z.object({ id: z.string(), householdId: z.string(), userId: z.string(), role: z.enum(['owner', 'admin', 'member', 'viewer']) }).passthrough(),
  ),
  collections: z.object(Object.fromEntries(HOUSEHOLD_COLLECTIONS.map((name) => [name, z.array(record)])) as Record<HouseholdCollectionName, z.ZodArray<typeof record>>),
  files: z.array(z.object({ id: z.string(), dataUrl: z.string().startsWith('data:') })),
});

export interface BackupSummary {
  householdName: string;
  exportedAt: string;
  counts: { label: string; count: number }[];
  memberCount: number;
  fileCount: number;
  existsLocally: boolean;
}

export type ParsedBackup = { ok: true; backup: HouseholdBackup; summary: BackupSummary } | { ok: false; errors: string[] };

const SUMMARY_LABELS: Partial<Record<HouseholdCollectionName, string>> = {
  inventoryItems: 'Inventory items',
  shoppingItems: 'Shopping items',
  tasks: 'Tasks',
  bills: 'Bills',
  expenses: 'Expenses',
  assets: 'Assets',
  maintenanceTasks: 'Maintenance tasks',
  events: 'Calendar events',
  documents: 'Documents',
};

/** Parses and validates a backup file, reporting specific problems instead of failing silently. */
export async function parseBackup(file: File, state: RootState): Promise<ParsedBackup> {
  if (file.size > MAX_BACKUP_BYTES) return { ok: false, errors: ['The file is larger than 200 MB and can’t be restored here.'] };
  let json: unknown;
  try {
    json = JSON.parse(await file.text());
  } catch {
    return { ok: false, errors: ['This file isn’t valid JSON. Choose a backup created by HomeHub.'] };
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.slice(0, 8).map((issue) => `${issue.path.join('.') || 'file'}: ${issue.message}`),
    };
  }
  const backup = result.data as unknown as HouseholdBackup;
  const householdId = backup.household.id;
  const errors: string[] = [];
  for (const name of HOUSEHOLD_COLLECTIONS) {
    backup.collections[name].forEach((entry, index) => {
      if (entry.householdId !== householdId) errors.push(`${name} row ${index + 1}: belongs to a different household.`);
    });
  }
  backup.memberships.forEach((membership, index) => {
    if (membership.householdId !== householdId) errors.push(`memberships row ${index + 1}: belongs to a different household.`);
  });
  const documentIds = new Set(backup.collections.documents.map((document) => document.id));
  backup.files.forEach((entry, index) => {
    if (!documentIds.has(entry.id)) errors.push(`files row ${index + 1}: has no matching document.`);
  });
  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 8) };

  return {
    ok: true,
    backup,
    summary: {
      householdName: backup.household.name,
      exportedAt: backup.exportedAt,
      counts: Object.entries(SUMMARY_LABELS).map(([name, label]) => ({
        label: label!,
        count: backup.collections[name as HouseholdCollectionName].length,
      })),
      memberCount: backup.memberships.length,
      fileCount: backup.files.length,
      existsLocally: !!state.data.households[householdId],
    },
  };
}

/**
 * Restores a validated backup. An existing household is replaced (owner only); otherwise the
 * household is created with the restoring profile as its owner. Other people in the backup are
 * recreated as local profiles if they don't exist on this device.
 */
export function restoreBackup(backup: HouseholdBackup) {
  return async (dispatch: AppDispatch, getState: () => RootState): Promise<void> => {
    const state = getState();
    const userId = state.session.activeUserId;
    if (!userId) throw new PermissionError('Choose a profile first.');
    const householdId = backup.household.id;
    const existing = state.data.households[householdId];
    const myMembership = Object.values(state.data.memberships).find(
      (membership) => membership.householdId === householdId && membership.userId === userId,
    );
    if (existing && !can(myMembership?.role, 'deleteHousehold')) {
      throw new PermissionError('Only the household owner can restore over existing data.');
    }

    const now = new Date().toISOString();
    const users: User[] = backup.users
      .filter((user) => !state.data.users[user.id])
      .map((user) => ({ id: user.id, name: user.name, email: user.email, avatarColor: user.avatarColor, createdAt: user.createdAt, updatedAt: user.updatedAt }));
    const memberships: HouseholdMembership[] = backup.memberships
      .filter((membership) => membership.userId !== userId)
      .map((membership) => ({ ...membership, role: membership.role === 'owner' ? 'admin' : membership.role }));
    memberships.push({
      id: myMembership?.id ?? newId(),
      householdId,
      userId,
      role: 'owner',
      createdAt: myMembership?.createdAt ?? now,
      updatedAt: now,
    });
    const household: Household = { ...backup.household, ownerId: userId, updatedAt: now };
    const blobs: DocumentBlob[] = await Promise.all(
      backup.files.map(async (file) => ({ id: file.id, householdId, blob: await dataUrlToBlob(file.dataUrl) })),
    );

    const previousMemberships = Object.values(state.data.memberships)
      .filter((membership) => membership.householdId === householdId)
      .map((membership) => membership.id);
    if (existing) await deleteHouseholdRecords(householdId);
    const changes: ChangeSet = {
      put: {
        ...backup.collections,
        households: [household],
        users,
        preferences: users.map((user) => defaultPreferences(user.id, now)),
        memberships,
      },
      remove: { memberships: previousMemberships.filter((id) => !memberships.some((membership) => membership.id === id)) },
    };
    await writeChanges(changes, { blobs: { put: blobs } });
    await dispatch(reloadGlobal());
    broadcastChange({ kind: 'global' });
    broadcastChange({ kind: 'household', householdId });
    await dispatch(switchHousehold(householdId));
  };
}

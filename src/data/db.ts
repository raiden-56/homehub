import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';
import {
  GLOBAL_COLLECTIONS,
  HOUSEHOLD_COLLECTIONS,
  type ChangeSet,
  type CollectionName,
  type Collections,
  type GlobalCollections,
  type HouseholdCollections,
  isHouseholdCollection,
} from './collections';
import { DuplicateOperationError, TenantIsolationError } from './errors';
import type { DocumentBlob } from '@/types/models';

const DB_NAME = 'homehub';
const DB_VERSION = 1;

const BLOB_STORE = 'documentBlobs';
const OPERATION_STORE = 'operations';
const META_STORE = 'meta';

type AnyStoreName = string;
type Db = IDBPDatabase<unknown>;

let dbPromise: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const name of GLOBAL_COLLECTIONS) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
        for (const name of [...HOUSEHOLD_COLLECTIONS, BLOB_STORE, OPERATION_STORE]) {
          if (!db.objectStoreNames.contains(name)) {
            const store = db.createObjectStore(name, { keyPath: 'id' });
            store.createIndex('householdId', 'householdId');
          }
        }
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
      },
      blocked() {
        // Another tab holds an older version open; it will close on `versionchange`.
      },
    }).then((db) => {
      db.addEventListener('versionchange', () => db.close());
      return db;
    });
  }
  return dbPromise;
}

/** Closes the connection (used by tests and before deleting the database). */
export async function closeDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }
}

export async function deleteDatabase(): Promise<void> {
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

export type GlobalSnapshot = { [K in keyof GlobalCollections]: GlobalCollections[K][] };
export type HouseholdSnapshot = { [K in keyof HouseholdCollections]: HouseholdCollections[K][] };

export async function loadGlobal(): Promise<GlobalSnapshot> {
  const db = await getDb();
  const tx = db.transaction(GLOBAL_COLLECTIONS, 'readonly');
  const entries = await Promise.all(
    GLOBAL_COLLECTIONS.map(async (name) => [name, await tx.objectStore(name).getAll()] as const),
  );
  await tx.done;
  return Object.fromEntries(entries) as unknown as GlobalSnapshot;
}

export async function loadHousehold(householdId: string): Promise<HouseholdSnapshot> {
  const db = await getDb();
  const tx = db.transaction(HOUSEHOLD_COLLECTIONS, 'readonly');
  const entries = await Promise.all(
    HOUSEHOLD_COLLECTIONS.map(
      async (name) =>
        [name, await tx.objectStore(name).index('householdId').getAll(householdId)] as const,
    ),
  );
  await tx.done;
  return Object.fromEntries(entries) as unknown as HouseholdSnapshot;
}

export interface WriteOptions {
  /** When set, the write is rejected if an operation with this key was already applied. */
  idempotencyKey?: string;
  householdId?: string;
  blobs?: { put?: DocumentBlob[]; remove?: string[] };
}

function storesFor(changes: ChangeSet, options: WriteOptions): AnyStoreName[] {
  const names = new Set<AnyStoreName>([
    ...Object.keys(changes.put ?? {}),
    ...Object.keys(changes.remove ?? {}),
  ]);
  if (options.idempotencyKey) names.add(OPERATION_STORE);
  if (options.blobs?.put?.length || options.blobs?.remove?.length) names.add(BLOB_STORE);
  return [...names];
}

/**
 * Rejects the transaction if any household-owned record being written or deleted already
 * belongs to a different household (defence against overwriting another tenant's data).
 */
async function assertSameHousehold(
  tx: IDBPTransaction<unknown, string[], 'readwrite'>,
  changes: ChangeSet,
  householdId: string,
): Promise<void> {
  const checks: Promise<void>[] = [];
  const check = (name: CollectionName, id: string, incoming?: { householdId?: string }) => {
    if (!isHouseholdCollection(name)) return;
    if (incoming && incoming.householdId !== householdId) {
      checks.push(Promise.reject(new TenantIsolationError('That record belongs to a different household.')));
      return;
    }
    checks.push(
      tx
        .objectStore(name)
        .get(id)
        .then((existing: { householdId?: string } | undefined) => {
          if (existing && existing.householdId !== householdId) {
            throw new TenantIsolationError('That record belongs to a different household.');
          }
        }),
    );
  };
  for (const [name, records] of Object.entries(changes.put ?? {})) {
    for (const record of (records ?? []) as { id: string; householdId?: string }[]) {
      check(name as CollectionName, record.id, record);
    }
  }
  for (const [name, ids] of Object.entries(changes.remove ?? {})) {
    for (const id of ids ?? []) check(name as CollectionName, id);
  }
  await Promise.all(checks);
}

/**
 * Applies a change set in a single IndexedDB transaction: either every record is written,
 * or none are.
 */
export async function writeChanges(changes: ChangeSet, options: WriteOptions = {}): Promise<void> {
  const stores = storesFor(changes, options);
  if (stores.length === 0) return;
  const db = await getDb();
  const tx = db.transaction(stores, 'readwrite') as IDBPTransaction<unknown, string[], 'readwrite'>;
  try {
    if (options.idempotencyKey) {
      try {
        await tx.objectStore(OPERATION_STORE).add({
          id: options.idempotencyKey,
          householdId: options.householdId ?? '',
          at: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'ConstraintError') {
          throw new DuplicateOperationError('This action was already completed, so it was not applied again.');
        }
        throw error;
      }
    }
    if (options.householdId) await assertSameHousehold(tx, changes, options.householdId);
    const pending: Promise<unknown>[] = [];
    for (const [name, records] of Object.entries(changes.put ?? {})) {
      for (const record of records ?? []) pending.push(tx.objectStore(name).put(record));
    }
    for (const [name, ids] of Object.entries(changes.remove ?? {})) {
      for (const id of ids ?? []) pending.push(tx.objectStore(name).delete(id));
    }
    for (const blob of options.blobs?.put ?? []) pending.push(tx.objectStore(BLOB_STORE).put(blob));
    for (const id of options.blobs?.remove ?? []) pending.push(tx.objectStore(BLOB_STORE).delete(id));
    await Promise.all(pending);
    await tx.done;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      // Transaction already finished or aborted.
    }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

export async function getRecord<K extends CollectionName>(
  name: K,
  id: string,
): Promise<Collections[K] | undefined> {
  const db = await getDb();
  return (await db.get(name, id)) as Collections[K] | undefined;
}

export async function getDocumentBlob(id: string): Promise<DocumentBlob | undefined> {
  const db = await getDb();
  return (await db.get(BLOB_STORE, id)) as DocumentBlob | undefined;
}

export async function getDocumentBlobsForHousehold(householdId: string): Promise<DocumentBlob[]> {
  const db = await getDb();
  return (await db.getAllFromIndex(BLOB_STORE, 'householdId', householdId)) as DocumentBlob[];
}

export async function hasOperation(key: string): Promise<boolean> {
  const db = await getDb();
  return (await db.getKey(OPERATION_STORE, key)) !== undefined;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get(META_STORE, key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.put(META_STORE, value, key);
}

/** Removes every record that belongs to a household, including stored files. */
export async function deleteHouseholdRecords(householdId: string): Promise<void> {
  const db = await getDb();
  const stores = [...HOUSEHOLD_COLLECTIONS, BLOB_STORE, OPERATION_STORE];
  const tx = db.transaction(stores, 'readwrite');
  await Promise.all(
    stores.map(async (name) => {
      const keys = await tx.objectStore(name).index('householdId').getAllKeys(householdId);
      await Promise.all(keys.map((key) => tx.objectStore(name).delete(key)));
    }),
  );
  await tx.done;
}

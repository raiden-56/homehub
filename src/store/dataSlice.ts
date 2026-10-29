import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  GLOBAL_COLLECTIONS,
  HOUSEHOLD_COLLECTIONS,
  type ChangeSet,
  type CollectionName,
  type Collections,
} from '@/data/collections';
import type { GlobalSnapshot, HouseholdSnapshot } from '@/data/db';

export type Tables = { [K in CollectionName]: Record<string, Collections[K]> };

type LooseTables = Record<string, Record<string, { id: string }>>;

function emptyTables(): Tables {
  const tables: Record<string, object> = {};
  for (const name of [...GLOBAL_COLLECTIONS, ...HOUSEHOLD_COLLECTIONS]) tables[name] = {};
  return tables as Tables;
}

function indexById<T extends { id: string }>(records: T[]): Record<string, T> {
  const result: Record<string, T> = {};
  for (const record of records) result[record.id] = record;
  return result;
}

const dataSlice = createSlice({
  name: 'data',
  initialState: emptyTables,
  reducers: {
    globalLoaded(state, action: PayloadAction<GlobalSnapshot>) {
      const tables = state as unknown as LooseTables;
      for (const name of GLOBAL_COLLECTIONS) tables[name] = indexById<{ id: string }>(action.payload[name]);
    },
    householdLoaded(state, action: PayloadAction<HouseholdSnapshot>) {
      const tables = state as unknown as LooseTables;
      for (const name of HOUSEHOLD_COLLECTIONS) tables[name] = indexById<{ id: string }>(action.payload[name]);
    },
    householdCleared(state) {
      const tables = state as unknown as LooseTables;
      for (const name of HOUSEHOLD_COLLECTIONS) tables[name] = {};
    },
    changesApplied(state, action: PayloadAction<ChangeSet>) {
      const tables = state as unknown as LooseTables;
      for (const [name, records] of Object.entries(action.payload.put ?? {})) {
        const table = tables[name];
        if (!table) continue;
        for (const record of (records ?? []) as { id: string }[]) table[record.id] = record;
      }
      for (const [name, ids] of Object.entries(action.payload.remove ?? {})) {
        const table = tables[name];
        if (!table) continue;
        for (const id of ids ?? []) delete table[id];
      }
    },
  },
});

export const { globalLoaded, householdLoaded, householdCleared, changesApplied } = dataSlice.actions;
export default dataSlice.reducer;

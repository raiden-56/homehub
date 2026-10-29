import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SessionState {
  bootStatus: 'booting' | 'ready' | 'error';
  activeUserId: string | null;
  activeHouseholdId: string | null;
  householdStatus: LoadStatus;
  error: string | null;
}

const initialState: SessionState = {
  bootStatus: 'booting',
  activeUserId: null,
  activeHouseholdId: null,
  householdStatus: 'idle',
  error: null,
};

const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    booted(state) {
      state.bootStatus = 'ready';
      state.error = null;
    },
    bootFailed(state, action: PayloadAction<string>) {
      state.bootStatus = 'error';
      state.error = action.payload;
    },
    userSelected(state, action: PayloadAction<string | null>) {
      state.activeUserId = action.payload;
      state.activeHouseholdId = null;
      state.householdStatus = 'idle';
    },
    householdLoading(state, action: PayloadAction<string>) {
      state.activeHouseholdId = action.payload;
      state.householdStatus = 'loading';
      state.error = null;
    },
    householdReady(state) {
      state.householdStatus = 'ready';
    },
    householdFailed(state, action: PayloadAction<string>) {
      state.householdStatus = 'error';
      state.error = action.payload;
    },
    householdUnset(state) {
      state.activeHouseholdId = null;
      state.householdStatus = 'idle';
    },
  },
});

export const {
  booted,
  bootFailed,
  userSelected,
  householdLoading,
  householdReady,
  householdFailed,
  householdUnset,
} = sessionSlice.actions;
export default sessionSlice.reducer;

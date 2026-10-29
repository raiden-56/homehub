import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type QuickAddKind =
  | 'inventoryItem'
  | 'shoppingItem'
  | 'task'
  | 'expense'
  | 'bill'
  | 'maintenance'
  | 'event';

export interface UiState {
  quickAdd: QuickAddKind | null;
  searchOpen: boolean;
  sidebarCollapsed: boolean;
}

const initialState: UiState = {
  quickAdd: null,
  searchOpen: false,
  sidebarCollapsed: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    quickAddOpened(state, action: PayloadAction<QuickAddKind>) {
      state.quickAdd = action.payload;
    },
    quickAddClosed(state) {
      state.quickAdd = null;
    },
    searchToggled(state, action: PayloadAction<boolean>) {
      state.searchOpen = action.payload;
    },
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
  },
});

export const { quickAddOpened, quickAddClosed, searchToggled, sidebarToggled } = uiSlice.actions;
export default uiSlice.reducer;

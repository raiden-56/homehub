import { combineReducers, configureStore } from '@reduxjs/toolkit';
import data from '@/store/dataSlice';
import session from '@/store/sessionSlice';
import ui from '@/store/uiSlice';

const rootReducer = combineReducers({ data, session, ui });

export function createAppStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) =>
      getDefault({
        // Record tables can be large; the default dev-only checks become slow on every action.
        immutableCheck: { warnAfter: 200 },
        serializableCheck: { warnAfter: 200 },
      }),
  });
}

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];

export const store = createAppStore();

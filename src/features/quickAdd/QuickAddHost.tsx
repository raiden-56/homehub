import { lazy, Suspense } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { quickAddClosed } from '@/store/uiSlice';

const named = <T,>(loader: () => Promise<T>, key: keyof T) =>
  lazy(async () => ({ default: (await loader())[key] as React.ComponentType<{ open: boolean; onClose: () => void }> }));

const InventoryItemDialog = named(() => import('@/features/inventory/components/InventoryItemDialog'), 'InventoryItemDialog');
const ShoppingItemDialog = named(() => import('@/features/shopping/components/ShoppingItemDialog'), 'ShoppingItemDialog');
const TaskDialog = named(() => import('@/features/tasks/components/TaskDialog'), 'TaskDialog');
const ExpenseDialog = named(() => import('@/features/finance/components/ExpenseDialog'), 'ExpenseDialog');
const BillDialog = named(() => import('@/features/finance/components/BillDialog'), 'BillDialog');
const MaintenanceTaskDialog = named(() => import('@/features/maintenance/components/MaintenanceTaskDialog'), 'MaintenanceTaskDialog');
const EventDialog = named(() => import('@/features/calendar/components/EventDialog'), 'EventDialog');

/** Renders the form for the quick action chosen from the header's "Add new" menu. */
export function QuickAddHost() {
  const kind = useAppSelector((state) => state.ui.quickAdd);
  const dispatch = useAppDispatch();
  if (!kind) return null;
  const close = () => dispatch(quickAddClosed());
  const props = { open: true, onClose: close };
  return (
    <Suspense fallback={null}>
      {kind === 'inventoryItem' && <InventoryItemDialog {...props} />}
      {kind === 'shoppingItem' && <ShoppingItemDialog {...props} />}
      {kind === 'task' && <TaskDialog {...props} />}
      {kind === 'expense' && <ExpenseDialog {...props} />}
      {kind === 'bill' && <BillDialog {...props} />}
      {kind === 'maintenance' && <MaintenanceTaskDialog {...props} />}
      {kind === 'event' && <EventDialog {...props} />}
    </Suspense>
  );
}

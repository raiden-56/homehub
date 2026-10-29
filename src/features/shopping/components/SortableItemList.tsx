import { useMemo } from 'react';
import { Box } from '@mui/material';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ShoppingItem } from '@/types/models';
import { ShoppingItemRow, type ShoppingRowHandlers } from './ShoppingItemRow';

interface SortableItemListProps {
  items: ShoppingItem[];
  canEdit: boolean;
  categoryName: (id: string | undefined) => string | undefined;
  handlers: ShoppingRowHandlers;
  /** Receives the items in their new order. */
  onReorder: (ordered: ShoppingItem[]) => void;
}

/** Pending items with drag-and-drop (pointer, touch and keyboard) reordering. */
export function SortableItemList({ items, canEdit, categoryName, handlers, onReorder }: SortableItemListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const nameOf = (id: string | number) => items.find((item) => item.id === id)?.name ?? 'Item';
  const positionOf = (id: string | number) => ids.indexOf(String(id)) + 1;

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}. Position ${positionOf(active.id)} of ${ids.length}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} moved to position ${positionOf(over.id)} of ${ids.length}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped at position ${positionOf(over.id)} of ${ids.length}.` : `${nameOf(active.id)} dropped.`),
    onDragCancel: ({ active }) => `Reordering cancelled. ${nameOf(active.id)} returned to its place.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'To reorder, press space or enter on the handle, use the arrow keys to move, then press space or enter again to drop. Press escape to cancel.',
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <Box role="list" aria-label="Items to buy">
          {items.map((item) => (
            <ShoppingItemRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              sortable
              categoryName={categoryName(item.categoryId)}
              handlers={handlers}
            />
          ))}
        </Box>
      </SortableContext>
    </DndContext>
  );
}

import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@mui/material';
import { renderWithProviders, setupHousehold } from '@/test/utils';
import type { ShoppingItem, ShoppingList } from '@/types/models';
import ShoppingModule from '../ShoppingModule';
import { useAddToShoppingList, type AddToListEntry } from '../hooks';

const NOW = new Date().toISOString();

async function withList() {
  const h = await setupHousehold();
  const list: ShoppingList = {
    id: 'weekly',
    householdId: h.householdId,
    name: 'Weekly Groceries',
    archived: false,
    createdBy: h.userId,
    lastActivityAt: '2026-01-01T00:00:00.000Z',
    createdAt: NOW,
    updatedAt: NOW,
  };
  const milk: ShoppingItem = {
    id: 'milk',
    householdId: h.householdId,
    listId: list.id,
    name: 'Milk',
    quantity: 2,
    unit: 'L',
    inventoryItemId: 'inv-milk',
    priority: 'normal',
    purchased: false,
    addedBy: h.userId,
    sortOrder: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
  await h.seed({ put: { shoppingLists: [list], shoppingItems: [milk] } });
  return { h, list };
}

function AddHarness({ entries }: { entries: AddToListEntry[] }) {
  const add = useAddToShoppingList();
  return <Button onClick={() => void add(entries)}>Add entries</Button>;
}

describe('useAddToShoppingList', () => {
  it('adds new items to the most recent list and skips ones already pending', async () => {
    const { h, list } = await withList();
    const user = userEvent.setup();
    renderWithProviders(
      <AddHarness
        entries={[
          { name: 'Toned milk', unit: 'L', inventoryItemId: 'inv-milk' },
          { name: ' milk ', unit: 'L' },
          { name: 'Eggs', unit: 'pcs', quantity: 12 },
          { name: 'eggs', unit: 'pcs' },
        ]}
      />,
      { store: h.store },
    );
    await user.click(screen.getByRole('button', { name: 'Add entries' }));
    expect(await screen.findByText('Added “Eggs” to Weekly Groceries · 3 already on the list')).toBeInTheDocument();
    const items = Object.values(h.store.getState().data.shoppingItems);
    expect(items.map((item) => item.name).sort()).toEqual(['Eggs', 'Milk']);
    expect(items.find((item) => item.name === 'Eggs')).toMatchObject({ listId: list.id, quantity: 12, sortOrder: 2 });
    expect(h.store.getState().data.shoppingLists[list.id]!.lastActivityAt > list.lastActivityAt).toBe(true);
  });

  it('creates a list when the household has none', async () => {
    const h = await setupHousehold();
    const user = userEvent.setup();
    renderWithProviders(<AddHarness entries={[{ name: 'Bread', unit: 'pack' }]} />, { store: h.store });
    await user.click(screen.getByRole('button', { name: 'Add entries' }));
    await waitFor(() => expect(Object.values(h.store.getState().data.shoppingLists)).toHaveLength(1));
    const [list] = Object.values(h.store.getState().data.shoppingLists);
    expect(list?.name).toBe('Shopping list');
    expect(Object.values(h.store.getState().data.shoppingItems)[0]).toMatchObject({ name: 'Bread', listId: list?.id });
  });
});

describe('Shopping list page', () => {
  it('marks an item as bought and can undo it before it is recorded', async () => {
    const { h } = await withList();
    const user = userEvent.setup();
    renderWithProviders(<ShoppingModule />, { store: h.store, route: '/shopping/weekly', path: '/shopping/*' });

    expect(await screen.findByRole('heading', { name: 'Weekly Groceries' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Mark Milk as bought' }));
    await waitFor(() => expect(h.store.getState().data.shoppingItems.milk?.purchased).toBe(true));
    expect(h.store.getState().data.shoppingItems.milk?.purchasedBy).toBe(h.userId);

    await user.click(screen.getByRole('button', { name: /bought \(1\)/i }));
    expect(await screen.findByRole('button', { name: 'Record purchase' })).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Mark Milk as not bought' }));
    await waitFor(() => expect(h.store.getState().data.shoppingItems.milk?.purchased).toBe(false));
  });

  it('adds an item from the quick-add bar with quantity parsing', async () => {
    const { h } = await withList();
    const user = userEvent.setup();
    renderWithProviders(<ShoppingModule />, { store: h.store, route: '/shopping/weekly', path: '/shopping/*' });
    const input = await screen.findByRole('combobox', { name: 'Add item to Weekly Groceries' });
    await user.type(input, '2 kg tomatoes{Enter}');
    await waitFor(() =>
      expect(Object.values(h.store.getState().data.shoppingItems)).toContainEqual(
        expect.objectContaining({ name: 'Tomatoes', quantity: 2, unit: 'kg' }),
      ),
    );
    expect(Object.values(h.store.getState().data.shoppingItems)).toHaveLength(2);
  });

  it('shows a not-found state for an unknown list', async () => {
    const { h } = await withList();
    renderWithProviders(<ShoppingModule />, { store: h.store, route: '/shopping/nope', path: '/shopping/*' });
    expect(await screen.findByText('List not found')).toBeInTheDocument();
  });
});

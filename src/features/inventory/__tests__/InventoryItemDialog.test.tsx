import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setupHousehold } from '@/test/utils';
import { InventoryItemDialog } from '../components/InventoryItemDialog';
import { AdjustQuantityDialog } from '../components/AdjustQuantityDialog';

async function choose(user: ReturnType<typeof userEvent.setup>, label: RegExp, option: string) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: option }));
}

describe('InventoryItemDialog', () => {
  it('validates required fields, then saves the item with an opening-stock movement', async () => {
    const h = await setupHousehold();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<InventoryItemDialog open onClose={onClose} />, { store: h.store });

    // Category and location are prefilled (Miscellaneous / Pantry); the name is required.
    expect(screen.getByRole('combobox', { name: /category/i })).toHaveTextContent('Miscellaneous');
    expect(screen.getByRole('combobox', { name: /storage location/i })).toHaveTextContent('Pantry');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(Object.values(h.store.getState().data.inventoryItems)).toHaveLength(0);

    await user.type(screen.getByRole('textbox', { name: /^name/i }), 'Basmati rice');
    await choose(user, /category/i, 'Grains & staples');
    await choose(user, /storage location/i, 'Pantry');
    const quantity = screen.getByRole('spinbutton', { name: /^quantity/i });
    await user.clear(quantity);
    await user.type(quantity, '4');
    await user.click(screen.getByRole('button', { name: 'Add item' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const items = Object.values(h.store.getState().data.inventoryItems);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Basmati rice', quantity: 4, unit: 'pcs', archived: false });
    const movements = Object.values(h.store.getState().data.inventoryMovements);
    expect(movements).toEqual([expect.objectContaining({ itemId: items[0]!.id, type: 'initial', delta: 4, quantityAfter: 4 })]);
  });

  it('rejects an expiry date before the purchase date', async () => {
    const h = await setupHousehold();
    const user = userEvent.setup();
    renderWithProviders(<InventoryItemDialog open onClose={() => undefined} />, { store: h.store });
    await user.type(screen.getByLabelText(/purchase date/i), '2026-10-20');
    await user.type(screen.getByLabelText(/expiry date/i), '2026-10-10');
    await user.click(screen.getByRole('button', { name: 'Add item' }));
    expect(await screen.findByText('Expiry date can’t be before the purchase date')).toBeInTheDocument();
  });
});

describe('AdjustQuantityDialog', () => {
  it('records use and refuses to take stock below zero', async () => {
    const h = await setupHousehold();
    const now = new Date().toISOString();
    const item = {
      id: 'rice',
      householdId: h.householdId,
      name: 'Rice',
      categoryId: h.categoryIds[0]!,
      locationId: h.locationIds[0]!,
      quantity: 2,
      unit: 'kg',
      minQuantity: 1,
      archived: false,
      createdAt: now,
      updatedAt: now,
    };
    await h.seed({ put: { inventoryItems: [item] } });
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<AdjustQuantityDialog open item={item} mode="consume" onClose={onClose} />, { store: h.store });

    const amount = screen.getByRole('spinbutton', { name: /amount used/i });
    await user.type(amount, '3');
    await user.click(screen.getByRole('button', { name: 'Record use' }));
    expect(await screen.findByText('Only 2 kg available')).toBeInTheDocument();

    await user.clear(amount);
    await user.type(amount, '0.5');
    await user.click(screen.getByRole('button', { name: 'Record use' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.store.getState().data.inventoryItems.rice?.quantity).toBe(1.5);
    expect(Object.values(h.store.getState().data.inventoryMovements)).toEqual([
      expect.objectContaining({ itemId: 'rice', type: 'consume', delta: -0.5, quantityAfter: 1.5 }),
    ]);
  });
});

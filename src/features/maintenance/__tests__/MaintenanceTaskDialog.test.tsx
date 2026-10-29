import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setupHousehold } from '@/test/utils';
import { MaintenanceTaskDialog } from '../components/MaintenanceTaskDialog';

describe('MaintenanceTaskDialog', () => {
  it('validates required fields and saves a scheduled task', async () => {
    const h = await setupHousehold();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<MaintenanceTaskDialog open onClose={onClose} />, { store: h.store });

    await user.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByText('Task name is required')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/Task name/), 'Clean chimney filter');
    await user.type(screen.getByLabelText('Estimated cost'), '12.345');
    await user.click(screen.getByRole('button', { name: 'Schedule' }));
    expect(await screen.findByText('Enter a valid amount, e.g. 1250.50')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Estimated cost'));
    await user.type(screen.getByLabelText('Estimated cost'), '650');
    await user.click(screen.getByRole('button', { name: 'Schedule' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const tasks = Object.values(h.store.getState().data.maintenanceTasks);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ name: 'Clean chimney filter', status: 'scheduled', estimatedCostMinor: 65000, priority: 'medium' });
  });

  it('does not let viewers save', async () => {
    const h = await setupHousehold({ role: 'viewer' });
    renderWithProviders(<MaintenanceTaskDialog open onClose={() => undefined} />, { store: h.store });
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeDisabled();
  });
});

import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, setupHousehold } from '@/test/utils';
import { todayIn } from '@/lib/dates';
import type { Task } from '@/types/models';
import { TaskDialog } from '../components/TaskDialog';
import { TaskList } from '../components/TaskList';

describe('TaskDialog', () => {
  it('validates required fields, then saves a new task', async () => {
    const h = await setupHousehold();
    const user = userEvent.setup();
    renderWithProviders(<TaskDialog open onClose={() => undefined} />, { store: h.store });

    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(Object.values(h.store.getState().data.tasks)).toHaveLength(0);

    await user.type(screen.getByRole('textbox', { name: /title/i }), 'Mop the floors');
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(Object.values(h.store.getState().data.tasks)).toHaveLength(1));
    const created = Object.values(h.store.getState().data.tasks)[0]!;
    expect(created).toMatchObject({ title: 'Mop the floors', status: 'not_started', createdBy: h.userId, householdId: h.householdId });
  });

  it('requires a due date for repeating tasks', async () => {
    const h = await setupHousehold();
    const user = userEvent.setup();
    renderWithProviders(<TaskDialog open onClose={() => undefined} />, { store: h.store });
    await user.type(screen.getByRole('textbox', { name: /title/i }), 'Water plants');
    await user.click(screen.getByRole('combobox', { name: 'Repeat' }));
    await user.click(await screen.findByRole('option', { name: 'Daily' }));
    await user.click(screen.getByRole('button', { name: 'Create task' }));
    expect(await screen.findByText('Repeating tasks need a first due date')).toBeInTheDocument();
    expect(Object.values(h.store.getState().data.tasks)).toHaveLength(0);
  });
});

describe('TaskList', () => {
  it('completes a task from its row', async () => {
    const h = await setupHousehold();
    const today = todayIn('Asia/Kolkata');
    const now = new Date().toISOString();
    const task: Task = {
      id: 'task-1',
      householdId: h.householdId,
      title: 'Empty the dishwasher',
      category: 'Kitchen',
      priority: 'medium',
      status: 'not_started',
      dueDate: today,
      checklist: [],
      comments: [],
      boardOrder: 1,
      createdBy: h.userId,
      createdAt: now,
      updatedAt: now,
    };
    await h.seed({ put: { tasks: [task] } });
    const user = userEvent.setup();
    renderWithProviders(
      <TaskList tasks={[task]} sort="due" today={today} canEdit linkFor={(entry) => `/tasks/${entry.id}`} onEdit={() => undefined} onDelete={() => undefined} />,
      { store: h.store },
    );

    await user.click(screen.getByRole('button', { name: 'Mark “Empty the dishwasher” complete' }));
    await waitFor(() => expect(h.store.getState().data.tasks['task-1']?.status).toBe('completed'));
    expect(h.store.getState().data.tasks['task-1']?.completedBy).toBe(h.userId);
    expect(await screen.findByText('Completed “Empty the dishwasher”')).toBeInTheDocument();
  });
});

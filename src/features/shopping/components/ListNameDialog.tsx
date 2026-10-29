import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { useActiveHousehold, useCan, useCollection, useCommit, useCurrentUser } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { FormTextField } from '@/components/form/fields';
import type { ShoppingList } from '@/types/models';
import { nowIso } from '@/lib/ids';
import { requiredText } from '@/lib/validation';
import { paths } from '@/app/paths';
import { newListRecord } from '../hooks';

const schema = z.object({ name: requiredText('List name', 60) });
type FormValues = z.infer<typeof schema>;

/** Creates a new list (then opens it) or renames an existing one. */
export function ListNameDialog({ open, onClose, list }: { open: boolean; onClose: () => void; list?: ShoppingList }) {
  const household = useActiveHousehold();
  const user = useCurrentUser();
  const lists = useCollection('shoppingLists');
  const canEdit = useCan('edit');
  const commit = useCommit();
  const navigate = useNavigate();
  const { control, handleSubmit, reset, setError, formState } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: list?.name ?? '' },
  });

  useEffect(() => {
    if (open) reset({ name: list?.name ?? '' });
  }, [open, list, reset]);

  const onSubmit = handleSubmit(async ({ name }) => {
    if (!household || !user) return;
    const trimmed = name.trim();
    if (lists.some((entry) => entry.id !== list?.id && !entry.archived && entry.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('name', { message: 'You already have a list with that name' });
      return;
    }
    if (list) {
      const now = nowIso();
      const ok = await commit(
        { put: { shoppingLists: [{ ...list, name: trimmed, lastActivityAt: now, updatedAt: now }] } },
        {
          success: 'List renamed',
          undo: { put: { shoppingLists: [list] } },
          activity: { entity: 'shopping', entityId: list.id, message: `Renamed list “${list.name}” to “${trimmed}”` },
        },
      );
      if (ok) onClose();
      return;
    }
    const created = newListRecord(household.id, trimmed, user.id);
    const ok = await commit(
      { put: { shoppingLists: [created] } },
      { success: `Created “${trimmed}”`, activity: { entity: 'shopping', entityId: created.id, message: `Created the list “${trimmed}”` } },
    );
    if (ok) {
      onClose();
      navigate(paths.shoppingList(created.id, { add: true }));
    }
  });

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={list ? 'Rename list' : 'New shopping list'}
      onSubmit={onSubmit}
      submitLabel={list ? 'Save' : 'Create list'}
      submitting={formState.isSubmitting}
      submitDisabled={!canEdit}
      maxWidth="xs"
    >
      <FormTextField control={control} name="name" label="List name" required autoFocus placeholder="e.g. Weekly Groceries" />
    </FormDialog>
  );
}

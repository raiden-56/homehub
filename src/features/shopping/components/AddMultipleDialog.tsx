import { useEffect, useMemo, useState } from 'react';
import { Box, Stack, TextField, Typography } from '@mui/material';
import { useCan, useCollection } from '@/app/hooks';
import { FormDialog } from '@/components/ui/FormDialog';
import { StatusChip } from '@/components/ui/StatusChip';
import type { ShoppingList } from '@/types/models';
import { formatQuantity } from '@/features/inventory/logic';
import { useAddToShoppingList } from '../hooks';
import { findDuplicate, normaliseName, parseLines } from '../logic';

/** Paste or type several items, one per line, with a live preview. */
export function AddMultipleDialog({ open, onClose, list }: { open: boolean; onClose: () => void; list: ShoppingList }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const items = useCollection('shoppingItems');
  const inventory = useCollection('inventoryItems');
  const canEdit = useCan('edit');
  const addToList = useAddToShoppingList();

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const entries = useMemo(() => parseLines(text), [text]);
  const preview = useMemo(() => {
    const seen = new Set<string>();
    return entries.map((entry) => {
      const key = normaliseName(entry.name);
      const duplicate = !!findDuplicate(items, list.id, entry) || seen.has(key);
      seen.add(key);
      return { ...entry, duplicate };
    });
  }, [entries, items, list.id]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (entries.length === 0) return;
    setSubmitting(true);
    const byName = new Map(inventory.filter((entry) => !entry.archived).map((entry) => [normaliseName(entry.name), entry]));
    const result = await addToList(
      entries.map((entry) => {
        const match = byName.get(normaliseName(entry.name));
        return { ...entry, inventoryItemId: match?.id, categoryId: match?.categoryId };
      }),
      list.id,
    );
    setSubmitting(false);
    if (result) onClose();
  };

  const newCount = preview.filter((entry) => !entry.duplicate).length;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title="Add several items"
      description={`One item per line. Start with an amount if you like, e.g. “2 kg rice” or “6 eggs”.`}
      onSubmit={onSubmit}
      submitLabel={newCount > 0 ? `Add ${newCount} item${newCount === 1 ? '' : 's'}` : 'Add items'}
      submitting={submitting}
      submitDisabled={!canEdit || newCount === 0}
    >
      <Stack spacing={2}>
        <TextField
          label="Items"
          multiline
          minRows={5}
          maxRows={12}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={'2 L milk\n12 eggs\nCoriander\n1 kg tomatoes'}
          autoFocus
        />
        {preview.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Preview
            </Typography>
            <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {preview.map((entry, index) => (
                <Stack key={`${entry.name}-${index}`} component="li" direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
                    <strong>{entry.name}</strong> · {formatQuantity(entry.quantity)} {entry.unit}
                  </Typography>
                  {entry.duplicate && <StatusChip tone="neutral" label="Already on list — skipped" />}
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </FormDialog>
  );
}

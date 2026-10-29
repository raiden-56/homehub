import { useMemo, useState } from 'react';
import { Box, Button, Checkbox, MenuItem, TextField, Typography } from '@mui/material';
import { Plus, ShoppingCart } from 'lucide-react';
import { useCan, useCollection, useCommit, useCurrentUser } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Money } from '@/components/ui/Money';
import { ShoppingItemDialog } from '@/features/shopping/components/ShoppingItemDialog';
import { nowIso } from '@/lib/ids';
import { timeAgo } from '@/lib/dates';
import { paths } from '@/app/paths';
import { WidgetFooterLink, WidgetRow } from './WidgetList';

export function ShoppingWidget() {
  const lists = useCollection('shoppingLists');
  const items = useCollection('shoppingItems');
  const user = useCurrentUser();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const [chosen, setChosen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const active = useMemo(() => {
    const pending = (listId: string) => items.filter((item) => item.listId === listId && !item.purchased && !item.clearedAt);
    return lists
      .filter((list) => !list.archived)
      .map((list) => ({ list, pending: pending(list.id).sort((a, b) => a.sortOrder - b.sortOrder) }))
      .sort((a, b) => Number(b.pending.length > 0) - Number(a.pending.length > 0) || b.list.lastActivityAt.localeCompare(a.list.lastActivityAt));
  }, [lists, items]);

  const current = active.find((entry) => entry.list.id === chosen) ?? active[0];

  const togglePurchased = async (itemId: string) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item || !user || !current) return;
    const now = nowIso();
    await commit(
      {
        put: {
          shoppingItems: [{ ...item, purchased: true, purchasedAt: now, purchasedBy: user.id, updatedAt: now }],
          shoppingLists: [{ ...current.list, lastActivityAt: now, updatedAt: now }],
        },
      },
      {
        success: `Bought “${item.name}”`,
        undo: { put: { shoppingItems: [item], shoppingLists: [current.list] } },
        activity: { entity: 'shopping', entityId: item.id, message: `Bought “${item.name}” from ${current.list.name}` },
      },
    );
  };

  const estimated = current?.pending.reduce((sum, item) => sum + (item.estimatedPriceMinor ?? 0), 0) ?? 0;
  const hasEstimates = current?.pending.some((item) => item.estimatedPriceMinor !== undefined);

  return (
    <SectionCard
      title="Shopping overview"
      subtitle={current ? `${current.pending.length} remaining on ${current.list.name}` : 'No active lists'}
      icon={<ShoppingCart size={17} />}
      sx={{ height: '100%' }}
      action={
        canEdit && current ? (
          <Button size="small" startIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
            Add item
          </Button>
        ) : undefined
      }
    >
      {!current ? (
        <EmptyState
          compact
          icon={<ShoppingCart size={20} />}
          title="No shopping lists yet"
          description="Create a list to start adding items."
          action={
            canEdit ? (
              <Button size="small" variant="outlined" onClick={() => setAdding(true)}>
                Add an item
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {active.length > 1 && (
            <TextField
              select
              size="small"
              label="List"
              value={current.list.id}
              onChange={(event) => setChosen(event.target.value)}
              sx={{ mb: 1, maxWidth: 260 }}
            >
              {active.map((entry) => (
                <MenuItem key={entry.list.id} value={entry.list.id}>
                  {entry.list.name} ({entry.pending.length})
                </MenuItem>
              ))}
            </TextField>
          )}
          {current.pending.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              Your shopping list is empty. Everything on {current.list.name} has been bought.
            </Typography>
          ) : (
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label={`Pending items on ${current.list.name}`}>
              {current.pending.slice(0, 5).map((item) => (
                <Box component="li" key={item.id}>
                  <WidgetRow
                    leading={
                      <Checkbox
                        checked={false}
                        disabled={!canEdit}
                        onChange={() => togglePurchased(item.id)}
                        slotProps={{ input: { 'aria-label': `Mark “${item.name}” bought` } }}
                        sx={{ p: 0.5, ml: -0.5 }}
                      />
                    }
                    title={item.name}
                    subtitle={`${item.quantity} ${item.unit}${item.priority === 'high' ? ' · High priority' : ''}`}
                    trailing={item.estimatedPriceMinor !== undefined ? <Money minor={item.estimatedPriceMinor} sx={{ fontSize: 13, color: 'text.secondary' }} /> : undefined}
                  />
                </Box>
              ))}
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
            {hasEstimates ? (
              <>
                Estimated total <Money minor={estimated} /> ·{' '}
              </>
            ) : null}
            Updated {timeAgo(current.list.lastActivityAt)}
          </Typography>
        </>
      )}
      <WidgetFooterLink to={current ? paths.shoppingList(current.list.id) : paths.shopping()}>
        {current && current.pending.length > 5 ? `See all ${current.pending.length} items` : 'Open shopping'}
      </WidgetFooterLink>
      {adding && <ShoppingItemDialog open onClose={() => setAdding(false)} listId={current?.list.id} />}
    </SectionCard>
  );
}

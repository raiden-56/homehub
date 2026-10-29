import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  FormControlLabel,
  Link,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { AnimatePresence } from 'framer-motion';
import { CheckCheck, ClipboardCheck, Plus, ShoppingCart } from 'lucide-react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan, useCollection, useCommit, useHouseholdLoading } from '@/app/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { SearchField } from '@/components/ui/SearchField';
import { ShoppingListSkeleton } from '@/components/ui/Skeletons';
import { Money } from '@/components/ui/Money';
import { MotionItem } from '@/components/ui/motion';
import type { ShoppingItem } from '@/types/models';
import { nowIso } from '@/lib/ids';
import { paths } from '@/app/paths';
import { useTaxonomy } from '@/features/inventory/hooks';
import { QuickAddBar } from '../components/QuickAddBar';
import { AddMultipleDialog } from '../components/AddMultipleDialog';
import { ShoppingItemDialog } from '../components/ShoppingItemDialog';
import { ShoppingItemRow, type ShoppingRowHandlers } from '../components/ShoppingItemRow';
import { SortableItemList } from '../components/SortableItemList';
import { ReceivePurchaseDialog } from '../components/ReceivePurchaseDialog';
import { ListActionsMenu } from '../components/ListActionsMenu';
import { ListNameDialog } from '../components/ListNameDialog';
import { touchList, useShoppingItemActions } from '../hooks';
import { useListActions } from '../listActions';
import { summariseList } from '../logic';

type Show = 'pending' | 'purchased' | 'all';

export default function ShoppingListPage() {
  const { listId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const commit = useCommit();
  const lists = useCollection('shoppingLists');
  const allItems = useCollection('shoppingItems');
  const { categoryById } = useTaxonomy();
  const list = lists.find((entry) => entry.id === listId);
  const itemActions = useShoppingItemActions(list);
  const listActions = useListActions();

  const [query, setQuery] = useState('');
  const [grouped, setGrouped] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingMany, setAddingMany] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [receiving, setReceiving] = useState<ShoppingItem[] | null>(null);

  const showParam = params.get('show');
  const show: Show = showParam === 'purchased' || showParam === 'all' ? showParam : 'pending';

  const items = useMemo(() => allItems.filter((item) => item.listId === listId && !item.clearedAt), [allItems, listId]);
  const pending = useMemo(() => items.filter((item) => !item.purchased).sort((a, b) => a.sortOrder - b.sortOrder), [items]);
  const purchased = useMemo(
    () => items.filter((item) => item.purchased).sort((a, b) => (b.purchasedAt ?? '').localeCompare(a.purchasedAt ?? '')),
    [items],
  );
  const unrecorded = purchased.filter((item) => !item.receivedAt);

  if (loading) {
    return (
      <Card>
        <ShoppingListSkeleton />
      </Card>
    );
  }
  if (!list) {
    return (
      <ErrorState
        kind="not-found"
        title="List not found"
        action={
          <Button component={RouterLink} to={paths.shopping()}>
            Back to shopping
          </Button>
        }
      />
    );
  }

  const summary = summariseList(allItems, list.id);
  const categoryName = (id: string | undefined) => (id ? categoryById.get(id)?.name : undefined);
  const editable = canEdit && !list.archived;
  const q = query.trim().toLowerCase();
  const matches = (item: ShoppingItem) => !q || [item.name, item.notes].filter(Boolean).join(' ').toLowerCase().includes(q);
  const visiblePending = show === 'purchased' ? [] : pending.filter(matches);
  const visiblePurchased = show === 'pending' ? [] : purchased.filter(matches);
  const sortable = editable && show === 'pending' && !q && !grouped;

  const handlers: ShoppingRowHandlers = {
    onToggle: (item) => void itemActions.togglePurchased(item),
    onQuantity: (item, quantity) => void itemActions.changeQuantity(item, quantity),
    onEdit: (item) => setEditing(item),
    onRemove: (item) => void itemActions.remove(item),
    onRecord: (item) => setReceiving([item]),
  };

  const reorder = (ordered: ShoppingItem[]) => {
    const now = nowIso();
    const changed = ordered.flatMap((item, index) => (item.sortOrder === index + 1 ? [] : [{ ...item, sortOrder: index + 1, updatedAt: now }]));
    if (changed.length) void commit({ put: { shoppingItems: changed, shoppingLists: [touchList(list, now)] } });
  };

  const renderRows = (rows: ShoppingItem[]) => {
    if (!grouped) {
      return (
        <AnimatePresence initial={false}>
          {rows.map((item) => (
            <MotionItem key={item.id}>
              <ShoppingItemRow item={item} canEdit={editable} sortable={false} categoryName={categoryName(item.categoryId)} handlers={handlers} />
            </MotionItem>
          ))}
        </AnimatePresence>
      );
    }
    const groups = new Map<string, ShoppingItem[]>();
    for (const item of rows) {
      const name = categoryName(item.categoryId) ?? 'Other';
      groups.set(name, [...(groups.get(name) ?? []), item]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)))
      .map(([name, groupItems]) => (
        <Box key={name}>
          <Typography variant="overline" color="text.secondary" component="h3" sx={{ display: 'block', px: 2, pt: 1.5, pb: 0.5 }}>
            {name} · {groupItems.length}
          </Typography>
          {groupItems.map((item) => (
            <ShoppingItemRow key={item.id} item={item} canEdit={editable} sortable={false} handlers={handlers} />
          ))}
        </Box>
      ));
  };

  const setShow = (value: Show) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === 'pending') next.delete('show');
        else next.set('show', value);
        next.delete('add');
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <Breadcrumbs aria-label="Breadcrumb" sx={{ mb: 1 }}>
        <Link component={RouterLink} to={paths.shopping()} underline="hover" color="text.secondary">
          Shopping
        </Link>
        <Typography color="text.primary" noWrap>
          {list.name}
        </Typography>
      </Breadcrumbs>
      <PageHeader
        title={list.name}
        description={
          <>
            {summary.remaining} to buy
            {summary.hasEstimate && (
              <>
                {' · about '}
                <Money minor={summary.estimatedTotalMinor} />
              </>
            )}
            {' · shared with everyone in the household'}
          </>
        }
        actions={
          <>
            {editable && unrecorded.length > 0 && (
              <Button variant="outlined" startIcon={<ClipboardCheck size={16} />} onClick={() => setReceiving(unrecorded)}>
                Record {unrecorded.length} purchase{unrecorded.length === 1 ? '' : 's'}
              </Button>
            )}
            {editable && (
              <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setAdding(true)}>
                Add item
              </Button>
            )}
            {canEdit && <ListActionsMenu list={list} onRename={() => setRenaming(true)} onDeleted={() => navigate(paths.shopping())} />}
          </>
        }
      />

      {list.archived && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            canEdit ? (
              <Button color="inherit" size="small" onClick={() => void listActions.setArchived(list, false)}>
                Restore
              </Button>
            ) : undefined
          }
        >
          This list is archived. Restore it to add or tick off items.
        </Alert>
      )}

      {editable && <QuickAddBar list={list} autoFocus={params.get('add') === '1' || params.get('add') === 'true'} onAddMultiple={() => setAddingMany(true)} />}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
        <ToggleButtonGroup exclusive size="small" value={show} onChange={(_, value: Show | null) => value && setShow(value)} aria-label="Which items to show">
          <ToggleButton value="pending">To buy ({pending.length})</ToggleButton>
          <ToggleButton value="purchased">Bought ({purchased.length})</ToggleButton>
          <ToggleButton value="all">All</ToggleButton>
        </ToggleButtonGroup>
        <SearchField value={query} onChange={setQuery} placeholder="Search this list" sx={{ maxWidth: { sm: 260 } }} />
        <FormControlLabel control={<Switch checked={grouped} onChange={(event) => setGrouped(event.target.checked)} />} label="Group by category" />
        <Box sx={{ flex: 1 }} />
        {editable && purchased.length > 0 && (
          <Button color="inherit" startIcon={<CheckCheck size={16} />} onClick={() => void itemActions.clearCompleted(items)}>
            Clear completed
          </Button>
        )}
      </Stack>

      <Card>
        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart size={24} />}
            title="Your shopping list is empty."
            description={editable ? 'Type an item above and press Enter, or add several at once.' : 'Nothing to buy right now.'}
          />
        ) : visiblePending.length === 0 && visiblePurchased.length === 0 ? (
          <EmptyState
            compact
            icon={<ShoppingCart size={20} />}
            title={q ? `Nothing matches “${query.trim()}”` : show === 'purchased' ? 'Nothing bought yet' : 'Everything’s bought'}
            description={q ? 'Try another search.' : show === 'pending' ? 'Tick-off is complete. Record purchases to update inventory and expenses.' : undefined}
          />
        ) : (
          <>
            {visiblePending.length > 0 &&
              (sortable ? (
                <SortableItemList items={visiblePending} canEdit={editable} categoryName={categoryName} handlers={handlers} onReorder={reorder} />
              ) : (
                <Box role="list" aria-label="Items to buy">
                  {renderRows(visiblePending)}
                </Box>
              ))}
            {visiblePurchased.length > 0 && (
              <>
                {show === 'all' && (
                  <Typography variant="overline" color="text.secondary" component="h2" sx={{ display: 'block', px: 2, pt: 2, pb: 0.5 }}>
                    In the cart · {visiblePurchased.length}
                  </Typography>
                )}
                <Box role="list" aria-label="Bought items">
                  {renderRows(visiblePurchased)}
                </Box>
              </>
            )}
          </>
        )}
      </Card>
      {sortable && visiblePending.length > 1 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Drag the handle (or focus it and use Space and the arrow keys) to reorder items.
        </Typography>
      )}

      {adding && <ShoppingItemDialog open listId={list.id} onClose={() => setAdding(false)} />}
      {editing && <ShoppingItemDialog open item={editing} onClose={() => setEditing(null)} />}
      <AddMultipleDialog open={addingMany} list={list} onClose={() => setAddingMany(false)} />
      <ListNameDialog open={renaming} list={list} onClose={() => setRenaming(false)} />
      {receiving && <ReceivePurchaseDialog open list={list} items={receiving} onClose={() => setReceiving(null)} />}
    </>
  );
}

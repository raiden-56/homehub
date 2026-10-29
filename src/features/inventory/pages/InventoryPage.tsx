import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Button, Card, Pagination, Stack, Tooltip, Typography } from '@mui/material';
import { AlertTriangle, Archive, ArchiveRestore, CalendarClock, Download, MapPin, Package, Plus, Settings2, ShoppingCart, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCan, useCollection, useCurrency, useHouseholdLoading, useToday } from '@/app/hooks';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { DashboardMetricSkeleton, InventoryCardSkeleton, InventoryRowSkeleton } from '@/components/ui/Skeletons';
import { paths } from '@/app/paths';
import type { InventoryItem } from '@/types/models';
import { useAddToShoppingList } from '@/features/shopping/hooks';
import { InventoryItemDialog } from '../components/InventoryItemDialog';
import { AdjustQuantityDialog, type AdjustMode } from '../components/AdjustQuantityDialog';
import { InventoryItemDetail } from '../components/InventoryItemDetail';
import { InventoryGridView, InventoryListView } from '../components/InventoryViews';
import { InventoryToolbar, type InventoryViewMode } from '../components/InventoryToolbar';
import { ManageTaxonomyDialog } from '../components/ManageTaxonomyDialog';
import type { ItemActionHandlers } from '../components/ItemActionsMenu';
import { useExpiryLeadDays, useInventoryActions, useTaxonomy } from '../hooks';
import { expiryStatus, matchesFilters, sortItems, stockStatus, type InventoryFilterState, type InventorySort } from '../logic';
import { exportInventoryCsv } from '../export';

const PAGE_SIZE = 24;
const VIEW_KEY = 'homehub.inventory.view';
const FILTER_KEYS = ['q', 'stock', 'expiry', 'location', 'category', 'archived', 'sort'];

function readView(): InventoryViewMode {
  try {
    return window.localStorage.getItem(VIEW_KEY) === 'grid' ? 'grid' : 'list';
  } catch {
    return 'list';
  }
}

export default function InventoryPage() {
  const { itemId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const loading = useHouseholdLoading();
  const canEdit = useCan('edit');
  const today = useToday();
  const currency = useCurrency();
  const warningDays = useExpiryLeadDays();
  const items = useCollection('inventoryItems');
  const { categories, locations, categoryById, locationById } = useTaxonomy();
  const actions = useInventoryActions();
  const addToShoppingList = useAddToShoppingList();

  const [view, setView] = useState<InventoryViewMode>(readView);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [adjusting, setAdjusting] = useState<{ item: InventoryItem; mode: AdjustMode } | null>(null);
  const [managing, setManaging] = useState(false);

  const filters: InventoryFilterState = {
    q: params.get('q') ?? '',
    stock: (params.get('stock') as InventoryFilterState['stock']) || undefined,
    expiry: (params.get('expiry') as InventoryFilterState['expiry']) || undefined,
    location: params.get('location') || undefined,
    category: params.get('category') || undefined,
    archived: params.get('archived') === '1' || params.get('archived') === 'true',
  };
  const sortParam = params.get('sort');
  const sort: InventorySort = sortParam === 'quantity' || sortParam === 'purchaseDate' || sortParam === 'expiryDate' ? sortParam : 'name';
  const hasFilters = FILTER_KEYS.some((key) => key !== 'sort' && params.has(key));
  const filterKey = params.toString();

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [filterKey]);

  const setParam = useCallback(
    (key: string, value: string | undefined) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value) next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const changeView = (next: InventoryViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Storage unavailable (private mode); the choice just isn't remembered.
    }
  };

  const filtered = useMemo(
    () =>
      sortItems(
        items.filter((item) =>
          matchesFilters(item, filters, today, warningDays, categoryById.get(item.categoryId)?.name, locationById.get(item.locationId)?.name),
        ),
        sort,
      ),
    [items, filterKey, today, warningDays, categoryById, locationById, sort],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const active = items.filter((item) => !item.archived);
  const lowCount = active.filter((item) => stockStatus(item) !== 'ok').length;
  const expiringCount = active.filter((item) => expiryStatus(item, today, warningDays) === 'soon').length;
  const expiredCount = active.filter((item) => expiryStatus(item, today, warningDays) === 'expired').length;
  const locationsInUse = new Set(active.map((item) => item.locationId)).size;

  const selectedItems = filtered.filter((item) => selected.has(item.id));
  const detailItem = itemId ? items.find((item) => item.id === itemId) : undefined;
  const closeDetail = () => navigate(`${paths.inventory()}${location.search}`);

  const handlers: ItemActionHandlers = {
    onEdit: (item) => setEditing(item),
    onAdjust: (item, mode) => setAdjusting({ item, mode }),
    onAddToList: (list) => {
      void addToShoppingList(
        list.map((item) => ({
          name: item.name,
          unit: item.unit,
          categoryId: item.categoryId,
          inventoryItemId: item.id,
          quantity: item.minQuantity > item.quantity ? Math.max(1, Math.ceil(item.minQuantity - item.quantity)) : 1,
        })),
      );
    },
    onArchive: async (list) => {
      if (await actions.archive(list)) setSelected(new Set());
    },
    onRestore: async (list) => {
      if (await actions.restore(list)) setSelected(new Set());
    },
    onDelete: async (list) => {
      if (await actions.remove(list)) {
        setSelected(new Set());
        if (itemId && list.some((item) => item.id === itemId)) closeDetail();
      }
    },
  };

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addButton = canEdit ? (
    <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setCreating(true)}>
      Add item
    </Button>
  ) : (
    <Tooltip title="Viewers can’t add items">
      <span>
        <Button variant="contained" startIcon={<Plus size={18} />} disabled>
          Add item
        </Button>
      </span>
    </Tooltip>
  );

  const editingCurrent = editing ? (items.find((item) => item.id === editing.id) ?? editing) : undefined;
  const adjustingCurrent = adjusting ? (items.find((item) => item.id === adjusting.item.id) ?? adjusting.item) : undefined;

  return (
    <>
      <PageHeader
        title="Inventory"
        description="Everything in your pantry, fridge and cupboards — with stock levels and expiry dates."
        actions={
          <>
            <Button
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={() => exportInventoryCsv(filtered, categoryById, locationById, today, currency)}
              disabled={filtered.length === 0}
            >
              Export
            </Button>
            <Button variant="outlined" startIcon={<Settings2 size={16} />} onClick={() => setManaging(true)}>
              Categories
            </Button>
            {addButton}
          </>
        }
      />

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, mb: 3 }}
        component="section"
        aria-label="Inventory summary"
      >
        {loading ? (
          Array.from({ length: 4 }, (_, index) => <DashboardMetricSkeleton key={index} />)
        ) : (
          <>
            <StatCard label="Active items" value={active.length} icon={<Package size={18} />} to={paths.inventory()} />
            <StatCard
              label="Low or out of stock"
              value={lowCount}
              icon={<AlertTriangle size={18} />}
              tone={lowCount > 0 ? 'warning' : 'neutral'}
              detail={lowCount > 0 ? 'Below their minimum' : 'Everything is stocked'}
              to={paths.inventory({ stock: 'low' })}
            />
            <StatCard
              label="Expiring soon"
              value={expiringCount}
              icon={<CalendarClock size={18} />}
              tone={expiringCount > 0 ? 'terracotta' : 'neutral'}
              detail={expiredCount > 0 ? `${expiredCount} already expired` : `Within ${warningDays} days`}
              to={paths.inventory({ expiry: 'soon' })}
            />
            <StatCard
              label="Storage locations"
              value={locationsInUse}
              icon={<MapPin size={18} />}
              tone="neutral"
              detail={`${locations.length} defined`}
              to={paths.inventory()}
            />
          </>
        )}
      </Box>

      <InventoryToolbar
        filters={filters}
        sort={sort}
        view={view}
        categories={categories}
        locations={locations}
        onChange={setParam}
        onViewChange={changeView}
        onClear={() => setParams(sort === 'name' ? {} : { sort }, { replace: true })}
        hasFilters={hasFilters}
      />

      {canEdit && selected.size > 0 && (
        <Card
          sx={(theme) => ({
            mb: 2,
            px: 2,
            py: 1,
            backgroundColor: theme.tokens.sage,
            borderColor: theme.palette.primary.main,
            position: 'sticky',
            top: { xs: 64, md: 72 },
            zIndex: 2,
          })}
          role="region"
          aria-label="Bulk actions"
        >
          <Stack direction="row" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Typography sx={{ fontWeight: 700, mr: 1 }}>{selected.size} selected</Typography>
            {!filters.archived && (
              <Button size="small" startIcon={<ShoppingCart size={15} />} onClick={() => handlers.onAddToList(selectedItems)}>
                Add to shopping list
              </Button>
            )}
            {filters.archived ? (
              <Button size="small" startIcon={<ArchiveRestore size={15} />} onClick={() => handlers.onRestore(selectedItems)}>
                Restore
              </Button>
            ) : (
              <Button size="small" startIcon={<Archive size={15} />} onClick={() => handlers.onArchive(selectedItems)}>
                Archive
              </Button>
            )}
            <Button size="small" color="error" startIcon={<Trash2 size={15} />} onClick={() => handlers.onDelete(selectedItems)}>
              Delete
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button size="small" color="inherit" onClick={() => setSelected(new Set(filtered.map((item) => item.id)))}>
              Select all {filtered.length}
            </Button>
            <Button size="small" color="inherit" startIcon={<X size={15} />} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </Stack>
        </Card>
      )}

      {loading ? (
        view === 'grid' ? (
          <InventoryCardSkeleton />
        ) : (
          <Card>
            <InventoryRowSkeleton />
          </Card>
        )
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={24} />}
            title="No inventory items yet."
            description="Add what you keep at home to track stock levels, get low-stock reminders and see what’s about to expire."
            action={canEdit ? addButton : undefined}
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={24} />}
            title={filters.archived && !hasFiltersBeyondArchived(params) ? 'No archived items' : 'No items match these filters'}
            description={
              filters.archived && !hasFiltersBeyondArchived(params)
                ? 'Archived items are kept out of the way but stay searchable here.'
                : 'Try a different search or clear the filters to see everything.'
            }
            action={
              hasFilters ? (
                <Button variant="outlined" onClick={() => setParams(sort === 'name' ? {} : { sort }, { replace: true })}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} aria-live="polite">
            {filtered.length} item{filtered.length === 1 ? '' : 's'}
            {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ''}
          </Typography>
          {view === 'grid' ? (
            <InventoryGridView
              items={visible}
              selected={selected}
              onToggle={toggle}
              canEdit={canEdit}
              handlers={handlers}
              today={today}
              warningDays={warningDays}
              categoryById={categoryById}
              locationById={locationById}
              search={location.search}
            />
          ) : (
            <Card>
              <InventoryListView
                items={visible}
                selected={selected}
                onToggle={toggle}
                canEdit={canEdit}
                handlers={handlers}
                today={today}
                warningDays={warningDays}
                categoryById={categoryById}
                locationById={locationById}
                search={location.search}
              />
            </Card>
          )}
          {pageCount > 1 && (
            <Stack alignItems="center" sx={{ mt: 2.5 }}>
              <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
            </Stack>
          )}
        </>
      )}

      {itemId && !loading && !detailItem && (
        <Box sx={{ mt: 3 }}>
          <Card>
            <ErrorState kind="not-found" title="Item not found" action={<Button onClick={closeDetail}>Back to inventory</Button>} />
          </Card>
        </Box>
      )}
      {detailItem && (
        <InventoryItemDetail
          open
          item={detailItem}
          onClose={closeDetail}
          canEdit={canEdit}
          handlers={handlers}
          today={today}
          warningDays={warningDays}
          category={categoryById.get(detailItem.categoryId)}
          location={locationById.get(detailItem.locationId)}
        />
      )}

      {creating && <InventoryItemDialog open onClose={() => setCreating(false)} />}
      {editingCurrent && <InventoryItemDialog open item={editingCurrent} onClose={() => setEditing(null)} />}
      {adjusting && adjustingCurrent && (
        <AdjustQuantityDialog open item={adjustingCurrent} mode={adjusting.mode} onClose={() => setAdjusting(null)} />
      )}
      <ManageTaxonomyDialog open={managing} onClose={() => setManaging(false)} />
    </>
  );
}

function hasFiltersBeyondArchived(params: URLSearchParams): boolean {
  return ['q', 'stock', 'expiry', 'location', 'category'].some((key) => params.has(key));
}

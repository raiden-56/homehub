import { useMemo, useState } from 'react';
import { Box, Button, IconButton, Link, Stack, Tooltip } from '@mui/material';
import { PackageCheck, PackageSearch, ShoppingCart, SlidersHorizontal } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector, useCan, useCollection, useToday } from '@/app/hooks';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusChip } from '@/components/ui/StatusChip';
import { selectCurrentPreferences } from '@/store/selectors';
import { DEFAULT_EXPIRY_WARNING_DAYS, expiryStatus, stockStatus } from '@/features/inventory/logic';
import { AdjustQuantityDialog } from '@/features/inventory/components/AdjustQuantityDialog';
import { useAddToShoppingList } from '@/features/shopping/hooks';
import { relativeDay } from '@/lib/dates';
import { paths } from '@/app/paths';
import type { InventoryItem } from '@/types/models';
import { WidgetFooterLink, WidgetRow, rowLinkSx } from './WidgetList';

export function InventoryAlertsWidget() {
  const items = useCollection('inventoryItems');
  const warningDays = useAppSelector(selectCurrentPreferences)?.notifications.expiryLeadDays ?? DEFAULT_EXPIRY_WARNING_DAYS;
  const today = useToday();
  const canEdit = useCan('edit');
  const addToList = useAddToShoppingList();
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const alerts = useMemo(
    () =>
      items
        .filter((item) => !item.archived)
        .map((item) => ({ item, stock: stockStatus(item), expiry: expiryStatus(item, today, warningDays) }))
        .filter(({ item, stock, expiry }) => stock !== 'ok' || ((expiry === 'soon' || expiry === 'expired') && item.quantity > 0))
        .sort((a, b) => {
          const rank = (entry: typeof a) =>
            entry.expiry === 'expired' && entry.item.quantity > 0 ? 0 : entry.stock === 'out' ? 1 : entry.expiry === 'soon' ? 2 : 3;
          return rank(a) - rank(b) || a.item.name.localeCompare(b.item.name);
        }),
    [items, today, warningDays],
  );

  return (
    <SectionCard
      title="Inventory alerts"
      subtitle={alerts.length > 0 ? `${alerts.length} item${alerts.length === 1 ? '' : 's'} need a look` : 'Stock and expiry'}
      icon={<PackageSearch size={17} />}
      sx={{ height: '100%' }}
    >
      {alerts.length === 0 ? (
        <EmptyState compact icon={<PackageCheck size={20} />} title="Everything is stocked" description="No low-stock or expiring items right now." />
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Inventory alerts">
          {alerts.slice(0, 6).map(({ item, stock, expiry }) => {
            const expiring = (expiry === 'soon' || expiry === 'expired') && item.quantity > 0;
            return (
              <Box component="li" key={item.id}>
                <WidgetRow
                  title={
                    <Link component={RouterLink} to={paths.inventoryItem(item.id)} sx={rowLinkSx}>
                      {item.name}
                    </Link>
                  }
                  subtitle={
                    expiring
                      ? `${expiry === 'expired' ? 'Expired' : 'Expires'} ${relativeDay(item.expiryDate!, today).toLowerCase()} · ${item.quantity} ${item.unit}`
                      : `${item.quantity} ${item.unit} left · minimum ${item.minQuantity}`
                  }
                  trailing={
                    <>
                      {expiring ? (
                        <StatusChip tone={expiry === 'expired' ? 'danger' : 'warning'} label={expiry === 'expired' ? 'Expired' : 'Expiring'} />
                      ) : (
                        <StatusChip tone={stock === 'out' ? 'danger' : 'warning'} label={stock === 'out' ? 'Out' : 'Low'} />
                      )}
                      {canEdit && (
                        <Tooltip title="Update quantity">
                          <IconButton size="small" aria-label={`Update quantity of ${item.name}`} onClick={() => setAdjusting(item)}>
                            <SlidersHorizontal size={16} />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canEdit && stock !== 'ok' && (
                        <Tooltip title="Add to shopping list">
                          <span>
                            <IconButton
                              size="small"
                              aria-label={`Add ${item.name} to shopping list`}
                              disabled={adding === item.id}
                              onClick={async () => {
                                setAdding(item.id);
                                await addToList([
                                  {
                                    name: item.name,
                                    quantity: Math.max(item.minQuantity - item.quantity, 1),
                                    unit: item.unit,
                                    categoryId: item.categoryId,
                                    inventoryItemId: item.id,
                                  },
                                ]);
                                setAdding(null);
                              }}
                            >
                              <ShoppingCart size={16} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                    </>
                  }
                />
              </Box>
            );
          })}
        </Box>
      )}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <WidgetFooterLink to={paths.inventory({ stock: 'low' })}>Open inventory</WidgetFooterLink>
        {canEdit && alerts.some((entry) => entry.stock !== 'ok') && (
          <Button
            size="small"
            startIcon={<ShoppingCart size={15} />}
            sx={{ mt: 1.5 }}
            onClick={() =>
              addToList(
                alerts
                  .filter((entry) => entry.stock !== 'ok')
                  .map(({ item }) => ({
                    name: item.name,
                    quantity: Math.max(item.minQuantity - item.quantity, 1),
                    unit: item.unit,
                    categoryId: item.categoryId,
                    inventoryItemId: item.id,
                  })),
              )
            }
          >
            Add all low stock to list
          </Button>
        )}
      </Stack>
      {adjusting && <AdjustQuantityDialog open onClose={() => setAdjusting(null)} item={adjusting} mode="adjust" />}
    </SectionCard>
  );
}

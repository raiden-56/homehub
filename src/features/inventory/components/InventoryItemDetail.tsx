import { useMemo, useState } from 'react';
import { Alert, Box, Button, Divider, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { Archive, ArchiveRestore, MinusCircle, Pencil, PlusCircle, ShoppingCart, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useAppSelector, useCollection } from '@/app/hooks';
import { DetailDrawer, DetailRow } from '@/components/ui/DetailDrawer';
import { Money } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import { selectHouseholdTimeZone } from '@/store/selectors';
import type { InventoryCategory, InventoryItem, InventoryLocation } from '@/types/models';
import { formatDate, formatTimestamp, relativeDay } from '@/lib/dates';
import { InventoryStatusChips } from './InventoryStatusChips';
import type { ItemActionHandlers } from './ItemActionsMenu';
import { MOVEMENT_LABELS, estimateConsumption, formatQuantity, stockStatus } from '../logic';

interface InventoryItemDetailProps {
  item: InventoryItem;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  handlers: ItemActionHandlers;
  today: string;
  warningDays: number;
  category?: InventoryCategory;
  location?: InventoryLocation;
}

const HISTORY_PAGE = 10;

export function InventoryItemDetail({
  item,
  open,
  onClose,
  canEdit,
  handlers,
  today,
  warningDays,
  category,
  location,
}: InventoryItemDetailProps) {
  const allMovements = useCollection('inventoryMovements');
  const timeZone = useAppSelector(selectHouseholdTimeZone);
  const [showAll, setShowAll] = useState(false);
  const movements = useMemo(
    () => allMovements.filter((movement) => movement.itemId === item.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    [allMovements, item.id],
  );
  const estimate = useMemo(() => estimateConsumption(item, movements, today, timeZone), [item, movements, today, timeZone]);
  const status = stockStatus(item);
  const visible = showAll ? movements : movements.slice(0, HISTORY_PAGE);

  return (
    <DetailDrawer
      open={open}
      onClose={onClose}
      title={item.name}
      subtitle={`${category?.name ?? 'Uncategorised'} · ${location?.name ?? 'No location'}`}
      actions={
        canEdit ? (
          <Tooltip title="Edit item">
            <IconButton aria-label={`Edit ${item.name}`} onClick={() => handlers.onEdit(item)}>
              <Pencil size={18} />
            </IconButton>
          </Tooltip>
        ) : undefined
      }
    >
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h1" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatQuantity(item.quantity)}{' '}
            <Typography component="span" color="text.secondary">
              {item.unit}
            </Typography>
          </Typography>
          <Box sx={{ mt: 1 }}>
            <InventoryStatusChips item={item} today={today} warningDays={warningDays} showOk />
          </Box>
        </Box>

        {canEdit && !item.archived && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Button variant="outlined" startIcon={<MinusCircle size={16} />} onClick={() => handlers.onAdjust(item, 'consume')} disabled={item.quantity <= 0}>
              Record use
            </Button>
            <Button variant="outlined" startIcon={<PlusCircle size={16} />} onClick={() => handlers.onAdjust(item, 'restock')}>
              Restock
            </Button>
            <Button variant="outlined" startIcon={<SlidersHorizontal size={16} />} onClick={() => handlers.onAdjust(item, 'adjust')}>
              Set exact
            </Button>
            <Button
              variant={status === 'ok' ? 'outlined' : 'contained'}
              startIcon={<ShoppingCart size={16} />}
              onClick={() => handlers.onAddToList([item])}
            >
              Add to shopping list
            </Button>
          </Stack>
        )}

        <Box>
          <Typography variant="h3" component="h3" sx={{ mb: 1 }}>
            Run-out estimate
          </Typography>
          {estimate.kind === 'estimate' ? (
            <Alert severity={estimate.daysLeft < 7 ? 'warning' : 'info'} icon={false}>
              Likely to run out around <strong>{formatDate(estimate.runOutDate, 'd MMM')}</strong> ({relativeDay(estimate.runOutDate, today).toLowerCase()}) — an
              estimate based on {estimate.events} recorded uses averaging {formatQuantity(estimate.dailyRate)} {item.unit} a day. It’s a suggestion, not a guarantee.
            </Alert>
          ) : estimate.kind === 'out' ? (
            <Alert severity="warning" icon={false}>
              This item is out of stock now.
            </Alert>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not enough usage history yet — HomeHub needs a few more recorded uses to estimate. Use “Record use” when you use this item
              ({estimate.events} recorded in the last 60 days; at least 3 over a week are needed).
            </Typography>
          )}
        </Box>

        <Box>
          <Typography variant="h3" component="h3" sx={{ mb: 0.5 }}>
            Details
          </Typography>
          <DetailRow label="Minimum stock">{item.minQuantity > 0 ? `${formatQuantity(item.minQuantity)} ${item.unit}` : 'Not set'}</DetailRow>
          <DetailRow label="Purchase price">
            <Money minor={item.purchasePriceMinor} fallback="Not recorded" />
          </DetailRow>
          <DetailRow label="Purchase date">{item.purchaseDate ? formatDate(item.purchaseDate) : 'Not recorded'}</DetailRow>
          <DetailRow label="Expiry date">{item.expiryDate ? formatDate(item.expiryDate) : 'Doesn’t expire'}</DetailRow>
          {item.barcode && <DetailRow label="Barcode">{item.barcode}</DetailRow>}
          {item.notes && <DetailRow label="Notes">{item.notes}</DetailRow>}
          <DetailRow label="Last updated">{formatTimestamp(item.updatedAt)}</DetailRow>
        </Box>

        <Box>
          <Typography variant="h3" component="h3" sx={{ mb: 1 }}>
            Stock history
          </Typography>
          {movements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No stock changes recorded yet.
            </Typography>
          ) : (
            <Stack divider={<Divider flexItem />} component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {visible.map((movement) => (
                <Stack key={movement.id} component="li" direction="row" spacing={1.5} alignItems="center" sx={{ py: 1 }}>
                  <MemberAvatar userId={movement.actorId} size={26} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {MOVEMENT_LABELS[movement.type]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="p">
                      {formatTimestamp(movement.occurredAt)}
                      {movement.note ? ` · ${movement.note}` : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography
                      variant="body2"
                      sx={(theme) => ({
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        color: movement.delta < 0 ? theme.tokens.terracottaText : theme.tokens.successText,
                      })}
                    >
                      {movement.delta > 0 ? '+' : ''}
                      {formatQuantity(movement.delta)} {item.unit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      → {formatQuantity(movement.quantityAfter)}
                    </Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
          {movements.length > HISTORY_PAGE && (
            <Button size="small" onClick={() => setShowAll((value) => !value)} sx={{ mt: 1 }}>
              {showAll ? 'Show fewer' : `Show all ${movements.length} changes`}
            </Button>
          )}
        </Box>

        {canEdit && (
          <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
            {item.archived ? (
              <Button startIcon={<ArchiveRestore size={16} />} onClick={() => handlers.onRestore([item])}>
                Restore
              </Button>
            ) : (
              <Button color="inherit" startIcon={<Archive size={16} />} onClick={() => handlers.onArchive([item])}>
                Archive
              </Button>
            )}
            <Button color="error" startIcon={<Trash2 size={16} />} onClick={() => handlers.onDelete([item])}>
              Delete
            </Button>
          </Stack>
        )}
      </Stack>
    </DetailDrawer>
  );
}

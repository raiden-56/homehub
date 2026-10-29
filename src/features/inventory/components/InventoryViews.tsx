import { AnimatePresence } from 'framer-motion';
import { Box, Card, CardActionArea, Checkbox, IconButton, LinearProgress, Link, Stack, Tooltip, Typography } from '@mui/material';
import { Minus } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import type { InventoryCategory, InventoryItem, InventoryLocation } from '@/types/models';
import { MotionItem } from '@/components/ui/motion';
import { formatDate } from '@/lib/dates';
import { paths } from '@/app/paths';
import { InventoryStatusChips } from './InventoryStatusChips';
import { ItemActionsMenu, type ItemActionHandlers } from './ItemActionsMenu';
import { formatQuantity, stockStatus } from '../logic';

export interface InventoryViewProps {
  items: InventoryItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  canEdit: boolean;
  handlers: ItemActionHandlers;
  today: string;
  warningDays: number;
  categoryById: Map<string, InventoryCategory>;
  locationById: Map<string, InventoryLocation>;
  /** Current query string, kept when opening an item so closing returns to the same view. */
  search: string;
}

function QuickUseButton({ item, onUse }: { item: InventoryItem; onUse: () => void }) {
  return (
    <Tooltip title="Record use">
      <span>
        <IconButton
          aria-label={`Record use of ${item.name}`}
          onClick={(event) => {
            event.stopPropagation();
            event.preventDefault();
            onUse();
          }}
          disabled={item.quantity <= 0}
        >
          <Minus size={18} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** Dense list: a table-like grid on desktop, stacked rows on phones. */
export function InventoryListView(props: InventoryViewProps) {
  const { items, selected, onToggle, canEdit, handlers, today, warningDays, categoryById, locationById, search } = props;
  return (
    <Box role="list" aria-label="Inventory items">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <MotionItem key={item.id}>
            <Box
              role="listitem"
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: `${canEdit ? '40px ' : ''}minmax(0, 1fr) auto auto`,
                  md: `${canEdit ? '40px ' : ''}minmax(0, 2fr) minmax(0, 1fr) 110px minmax(0, 1.4fr) auto auto`,
                },
                alignItems: 'center',
                columnGap: 1.5,
                px: { xs: 1, sm: 2 },
                py: 1.25,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: selected.has(item.id) ? 'action.selected' : undefined,
                transition: 'background-color 160ms ease',
                '&:hover': { bgcolor: selected.has(item.id) ? 'action.selected' : 'action.hover' },
              }}
            >
              {canEdit && (
                <Checkbox
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  slotProps={{ input: { 'aria-label': `Select ${item.name}` } }}
                />
              )}
              <Box sx={{ minWidth: 0 }}>
                <Link
                  component={RouterLink}
                  to={`${paths.inventoryItem(item.id)}${search}`}
                  underline="hover"
                  color="text.primary"
                  sx={{ fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {item.name}
                </Link>
                <Typography variant="caption" color="text.secondary" noWrap component="p">
                  {categoryById.get(item.categoryId)?.name ?? 'Uncategorised'}
                  <Box component="span" sx={{ display: { md: 'none' } }}>
                    {' · '}
                    {locationById.get(item.locationId)?.name ?? 'No location'}
                  </Box>
                </Typography>
                <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 0.5 }}>
                  <InventoryStatusChips item={item} today={today} warningDays={warningDays} />
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ display: { xs: 'none', md: 'block' } }}>
                {locationById.get(item.locationId)?.name ?? 'No location'}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', textAlign: { xs: 'right', md: 'left' }, whiteSpace: 'nowrap' }}
              >
                {formatQuantity(item.quantity)} {item.unit}
              </Typography>
              <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
                <InventoryStatusChips item={item} today={today} warningDays={warningDays} />
                {item.expiryDate && (
                  <Typography variant="caption" color="text.secondary">
                    Expires {formatDate(item.expiryDate)}
                  </Typography>
                )}
              </Box>
              {canEdit && !item.archived ? (
                <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                  <QuickUseButton item={item} onUse={() => handlers.onAdjust(item, 'consume')} />
                </Box>
              ) : (
                <Box sx={{ display: { xs: 'none', sm: 'block' } }} />
              )}
              {canEdit ? <ItemActionsMenu item={item} handlers={handlers} /> : <Box />}
            </Box>
          </MotionItem>
        ))}
      </AnimatePresence>
    </Box>
  );
}

/** Card grid with a stock gauge relative to the minimum threshold. */
export function InventoryGridView(props: InventoryViewProps) {
  const { items, selected, onToggle, canEdit, handlers, today, warningDays, categoryById, locationById, search } = props;
  return (
    <Box
      role="list"
      aria-label="Inventory items"
      sx={{ display: 'grid', gap: 2, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' }}
    >
      {items.map((item) => {
        const status = stockStatus(item);
        const gauge = item.minQuantity > 0 ? Math.min(100, (item.quantity / (item.minQuantity * 2)) * 100) : item.quantity > 0 ? 100 : 0;
        return (
          <Card
            key={item.id}
            role="listitem"
            sx={{
              position: 'relative',
              borderColor: selected.has(item.id) ? 'primary.main' : undefined,
              transition: 'border-color 160ms ease, box-shadow 160ms ease',
              '&:hover': { boxShadow: '0 6px 18px rgba(36, 69, 45, 0.08)' },
            }}
          >
            <CardActionArea component={RouterLink} to={`${paths.inventoryItem(item.id)}${search}`} sx={{ p: 2, pr: canEdit ? 9 : 2, height: '100%' }}>
              <Typography sx={{ fontWeight: 650 }} noWrap>
                {item.name}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="p">
                {categoryById.get(item.categoryId)?.name ?? 'Uncategorised'} · {locationById.get(item.locationId)?.name ?? 'No location'}
              </Typography>
              <Typography variant="h2" component="p" sx={{ mt: 1.5, fontVariantNumeric: 'tabular-nums' }}>
                {formatQuantity(item.quantity)}{' '}
                <Typography component="span" variant="body2" color="text.secondary">
                  {item.unit}
                </Typography>
              </Typography>
              <LinearProgress
                variant="determinate"
                value={gauge}
                color={status === 'ok' ? 'primary' : status === 'low' ? 'warning' : 'error'}
                sx={{ my: 1 }}
                aria-label={item.minQuantity > 0 ? `Stock level relative to minimum of ${item.minQuantity} ${item.unit}` : 'Stock level'}
              />
              <Stack spacing={0.5}>
                <InventoryStatusChips item={item} today={today} warningDays={warningDays} showOk />
                {item.minQuantity > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    Minimum {formatQuantity(item.minQuantity)} {item.unit}
                  </Typography>
                )}
              </Stack>
            </CardActionArea>
            {canEdit && (
              <Stack direction="row" sx={{ position: 'absolute', top: 6, right: 6 }} alignItems="center">
                <Checkbox
                  checked={selected.has(item.id)}
                  onChange={() => onToggle(item.id)}
                  slotProps={{ input: { 'aria-label': `Select ${item.name}` } }}
                />
                <ItemActionsMenu item={item} handlers={handlers} />
              </Stack>
            )}
          </Card>
        );
      })}
    </Box>
  );
}

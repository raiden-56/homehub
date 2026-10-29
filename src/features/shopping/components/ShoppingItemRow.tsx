import { useState } from 'react';
import { Box, Button, Checkbox, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckCircle2, GripVertical, Minus, MoreVertical, Pencil, Plus, ReceiptText, Trash2 } from 'lucide-react';
import { StatusChip } from '@/components/ui/StatusChip';
import { Money } from '@/components/ui/Money';
import { MemberAvatar } from '@/components/ui/MemberAvatar';
import type { ShoppingItem } from '@/types/models';
import { formatQuantity, roundQuantity } from '@/features/inventory/logic';

export interface ShoppingRowHandlers {
  onToggle: (item: ShoppingItem) => void;
  onQuantity: (item: ShoppingItem, quantity: number) => void;
  onEdit: (item: ShoppingItem) => void;
  onRemove: (item: ShoppingItem) => void;
  onRecord: (item: ShoppingItem) => void;
}

interface ShoppingItemRowProps {
  item: ShoppingItem;
  canEdit: boolean;
  /** Drag-to-reorder is only enabled in the unfiltered, ungrouped pending view. */
  sortable: boolean;
  categoryName?: string;
  handlers: ShoppingRowHandlers;
}

function stepFor(quantity: number): number {
  return quantity < 1 ? 0.25 : 1;
}

export function ShoppingItemRow({ item, canEdit, sortable, categoryName, handlers }: ShoppingItemRowProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !sortable || !canEdit,
  });
  const step = stepFor(item.quantity);

  return (
    <Box
      ref={setNodeRef}
      role="listitem"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: { xs: 1, sm: 1.5 },
        py: 1,
        minHeight: 60,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: isDragging ? 'background.paper' : undefined,
        boxShadow: isDragging ? '0 10px 24px rgba(36, 69, 45, 0.16)' : undefined,
        position: 'relative',
        zIndex: isDragging ? 2 : undefined,
      }}
    >
      {sortable && canEdit && (
        <IconButton
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${item.name}`}
          size="small"
          sx={{ cursor: 'grab', color: 'text.secondary', touchAction: 'none', px: { xs: 0, sm: 0.5 } }}
        >
          <GripVertical size={16} />
        </IconButton>
      )}
      <Checkbox
        checked={item.purchased}
        onChange={() => handlers.onToggle(item)}
        disabled={!canEdit}
        slotProps={{ input: { 'aria-label': item.purchased ? `Mark ${item.name} as not bought` : `Mark ${item.name} as bought` } }}
        sx={{ '& .MuiSvgIcon-root': { fontSize: 26 } }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontWeight: 600,
              textDecoration: item.purchased ? 'line-through' : 'none',
              color: item.purchased ? 'text.secondary' : 'text.primary',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name}
          </Typography>
          {item.priority === 'high' && !item.purchased && <StatusChip tone="terracotta" label="High priority" />}
          {item.priority === 'low' && !item.purchased && <StatusChip tone="neutral" label="Low priority" />}
        </Stack>
        <Typography variant="caption" color="text.secondary" component="p" noWrap>
          {formatQuantity(item.quantity)} {item.unit}
          {categoryName ? ` · ${categoryName}` : ''}
          {item.notes ? ` · ${item.notes}` : ''}
        </Typography>
        {item.purchased && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5, flexWrap: 'wrap', rowGap: 0.5 }}>
            {item.receivedAt ? (
              <StatusChip tone="success" label="Recorded" icon={<CheckCircle2 />} />
            ) : (
              canEdit && (
                <Button size="small" variant="outlined" startIcon={<ReceiptText size={14} />} onClick={() => handlers.onRecord(item)} sx={{ minHeight: 28 }}>
                  Record purchase
                </Button>
              )
            )}
          </Stack>
        )}
      </Box>
      {!item.purchased && canEdit && (
        <Stack direction="row" alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }} aria-label={`Quantity of ${item.name}`} role="group">
          <IconButton
            size="small"
            aria-label={`Decrease ${item.name}`}
            disabled={roundQuantity(item.quantity - step) <= 0}
            onClick={() => handlers.onQuantity(item, roundQuantity(item.quantity - step))}
          >
            <Minus size={16} />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: 28, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
            {formatQuantity(item.quantity)}
          </Typography>
          <IconButton size="small" aria-label={`Increase ${item.name}`} onClick={() => handlers.onQuantity(item, roundQuantity(item.quantity + step))}>
            <Plus size={16} />
          </IconButton>
        </Stack>
      )}
      <Box sx={{ textAlign: 'right', minWidth: { xs: 0, sm: 72 } }}>
        {item.actualPriceMinor !== undefined ? (
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            <Money minor={item.actualPriceMinor} />
          </Typography>
        ) : item.estimatedPriceMinor !== undefined ? (
          <Typography variant="body2" color="text.secondary" title="Estimated">
            ~<Money minor={item.estimatedPriceMinor} />
          </Typography>
        ) : null}
      </Box>
      <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
        <MemberAvatar userId={item.purchased ? (item.purchasedBy ?? item.addedBy) : item.addedBy} size={26} />
      </Box>
      {canEdit && (
        <>
          <IconButton aria-label={`More actions for ${item.name}`} aria-haspopup="menu" onClick={(event) => setAnchor(event.currentTarget)}>
            <MoreVertical size={18} />
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <MenuItem onClick={() => { setAnchor(null); handlers.onEdit(item); }}>
              <ListItemIcon><Pencil size={16} /></ListItemIcon>
              <ListItemText primary="Edit" />
            </MenuItem>
            {!item.purchased && [
              <MenuItem key="inc" onClick={() => { setAnchor(null); handlers.onQuantity(item, roundQuantity(item.quantity + step)); }}>
                <ListItemIcon><Plus size={16} /></ListItemIcon>
                <ListItemText primary="Increase quantity" />
              </MenuItem>,
              <MenuItem
                key="dec"
                disabled={roundQuantity(item.quantity - step) <= 0}
                onClick={() => { setAnchor(null); handlers.onQuantity(item, roundQuantity(item.quantity - step)); }}
              >
                <ListItemIcon><Minus size={16} /></ListItemIcon>
                <ListItemText primary="Decrease quantity" />
              </MenuItem>,
            ]}
            {item.purchased && !item.receivedAt && (
              <MenuItem onClick={() => { setAnchor(null); handlers.onRecord(item); }}>
                <ListItemIcon><ReceiptText size={16} /></ListItemIcon>
                <ListItemText primary="Record purchase" secondary="Update inventory & expenses" />
              </MenuItem>
            )}
            <MenuItem onClick={() => { setAnchor(null); handlers.onRemove(item); }} sx={{ color: 'error.main' }}>
              <ListItemIcon sx={{ color: 'inherit' }}><Trash2 size={16} /></ListItemIcon>
              <ListItemText primary="Remove" />
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
}
